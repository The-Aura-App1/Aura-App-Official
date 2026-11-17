import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Move, RotateCcw } from 'lucide-react';

// 8-Ball Pool. The server runs every shot (backend/lambdas/aura-aura/pool.mjs)
// and sends back a recording; this table only aims, sets power and spin,
// places the cue ball when it's in hand, and plays the recording back.
// Table sizes match pool.mjs (a test keeps them equal).
//
// Shooting: drag on the table to aim. Grab the cue stick behind the cue ball
// (or the power bar beside the table), pull it back for more power and let
// go to shoot; pulling back to nothing cancels. The spin ball sets where the
// tip hits the cue ball. The slider and Shoot button do the same from a
// keyboard.
export const W = 1000;
export const H = 2000;
export const R = 22;
export const HEAD_LINE = 1500;
export const CORNER_MOUTH = 62;
export const SIDE_MOUTH = 48;
const RAIL = 62;
const CUSHION = 16;          // how far the rubber cushion stands out from the rail
const FRAME_MS = 50;         // the server records 20 frames a second
const POCKETS = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const COLORS = { 1: '#f2c230', 2: '#2457d6', 3: '#d63333', 4: '#6c35a8', 5: '#f07d1a', 6: '#1d8a45', 7: '#8a2525', 8: '#121212' };
const color = n => COLORS[n > 8 ? n - 8 : n];
const GROUP = { solids: [1, 2, 3, 4, 5, 6, 7], stripes: [9, 10, 11, 12, 13, 14, 15] };
const FINE = Math.PI / 900;  // a fine-aim nudge: 0.2°
const MAX_PULL = 300;        // pulling the stick this far back is full power
const STICK = 1150;
const TIP_GAP = R + 14;      // the tip rests this far from the cue ball's centre

function spotFree(balls, x, y, kitchen) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  if (kitchen && y < HEAD_LINE) return false;
  return balls.every((b, n) => n === 0 || !b || Math.hypot(b[0] - x, b[1] - y) >= 2 * R + 0.5);
}

// Where the aim line from the cue ball first meets a ball (as a ghost ball) or
// a cushion, and where each ball heads after contact. The cue ball's line
// bends with spin the way a sliding ball settles into a roll: forward with
// follow, back with draw.
function aimPath(balls, cue, angle, spinTop) {
  const d = [Math.cos(angle), Math.sin(angle)];
  let best = Infinity, hit = null;
  balls.forEach((b, n) => {
    if (!n || !b) return;
    const m = [b[0] - cue[0], b[1] - cue[1]];
    const along = m[0] * d[0] + m[1] * d[1];
    if (along <= 0) return;
    const off2 = m[0] * m[0] + m[1] * m[1] - along * along;
    if (off2 > 4 * R * R) return;
    const t = along - Math.sqrt(4 * R * R - off2);
    if (t < best) { best = t; hit = n; }
  });
  const toRail = Math.min(
    d[0] > 0 ? (W - R - cue[0]) / d[0] : d[0] < 0 ? (R - cue[0]) / d[0] : Infinity,
    d[1] > 0 ? (H - R - cue[1]) / d[1] : d[1] < 0 ? (R - cue[1]) / d[1] : Infinity,
  );
  if (hit === null || toRail < best) return { end: [cue[0] + d[0] * toRail, cue[1] + d[1] * toRail], hit: null };
  const ghost = [cue[0] + d[0] * best, cue[1] + d[1] * best];
  const b = balls[hit];
  const nl = Math.hypot(b[0] - ghost[0], b[1] - ghost[1]) || 1;
  const n = [(b[0] - ghost[0]) / nl, (b[1] - ghost[1]) / nl];
  const dot = d[0] * n[0] + d[1] * n[1];
  const tangent = [d[0] - dot * n[0], d[1] - dot * n[1]];
  // a rolling cue ball keeps some forward spin; draw pulls it back
  const roll = 0.5 + spinTop * 0.9;
  const after = [tangent[0] * 5 / 7 + d[0] * dot * roll * 2 / 7, tangent[1] * 5 / 7 + d[1] * dot * roll * 2 / 7];
  const al = Math.hypot(after[0], after[1]);
  return { end: ghost, hit, ghost, objectDir: n, cueDir: al > 0.02 ? [after[0] / al, after[1] / al] : null, cueLen: al, dot };
}

// Each ball's orientation as it rolls: the point at the centre of its
// number (a unit vector; z towards the viewer). Moving a distance d turns it
// by d / R about the axis lying flat and square to the motion, so the number
// slides across the face, round the back and up again, like a real ball.
const START_POLE = n => { const a = n * 2.4; const t = 0.35; return [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]; };
function rolled(pole, dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d < 0.01) return pole;
  const k = [-dy / d, dx / d, 0];                 // the rolling axis
  const th = d / R, c = Math.cos(th), sn = Math.sin(th);
  const dot = k[0] * pole[0] + k[1] * pole[1];
  const cross = [k[1] * pole[2], -k[0] * pole[2], k[0] * pole[1] - k[1] * pole[0]];
  const v = [0, 1, 2].map(i => pole[i] * c + cross[i] * sn + k[i] * dot * (1 - c));
  const l = Math.hypot(...v) || 1;
  return v.map(x => x / l);
}

// Keeps each ball's orientation from frame to frame (safe to call twice with
// the same positions: nothing moves, nothing turns)
function useRolling(positions) {
  const state = useRef({ last: [], poles: [] });
  const s = state.current;
  positions.forEach((b, n) => {
    if (!s.poles[n]) s.poles[n] = START_POLE(n);
    const prev = s.last[n];
    if (b && prev) s.poles[n] = rolled(s.poles[n], b[0] - prev[0], b[1] - prev[1]);
    s.last[n] = b ? [b[0], b[1]] : null;
  });
  return s.poles;
}

function Ball({ n, x, y, clip, pole = [0, 0, 1] }) {
  const [px, py, pz] = pole;
  const tilt = (Math.atan2(py, px) * 180) / Math.PI;
  const shadow = <ellipse cx={4} cy={7} rx={R * 0.95} ry={R * 0.8} fill="#000" opacity="0.32" />;
  if (n === 0) {
    return (
      <g transform={`translate(${x} ${y})`}>
        {shadow}
        <circle r={R} fill="#f6f3ea" />
        {/* the cue ball's red dot, rolling like the numbers do */}
        {pz > 0 && <ellipse cx={px * R * 0.92} cy={py * R * 0.92} rx={R * 0.13 * Math.max(pz, 0.2)} ry={R * 0.13} transform={`rotate(${tilt} ${px * R * 0.92} ${py * R * 0.92})`} fill="#c23b3b" opacity="0.8" />}
        <circle r={R} fill={`url(#${clip}-shine)`} />
      </g>
    );
  }
  const stripe = n > 8;
  // the number's disc, foreshortened as it turns away
  const cx = px * R * 0.92, cy = py * R * 0.92;
  const disc = pz > 0.05 && (
    <g transform={`translate(${cx} ${cy}) rotate(${tilt})`}>
      <ellipse rx={R * 0.5 * pz} ry={R * 0.5} fill="#f6f3ea" />
      <g transform={`rotate(${-tilt}) scale(${Math.max(pz, 0.25)} 1)`} opacity={Math.min(1, pz * 1.6)}>
        <text y={6} textAnchor="middle" fontSize={n > 9 ? 15 : 17} fontWeight="700" fill="#141414" fontFamily="system-ui, sans-serif">{n}</text>
      </g>
    </g>
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      {shadow}
      <circle r={R} fill={stripe ? '#f6f3ea' : color(n)} />
      {/* a stripe is the band round the ball's equator, seen at whatever tilt it has rolled to */}
      {stripe && (
        <g clipPath={`url(#${clip})`}>
          <ellipse rx={R * 1.02} ry={R * Math.max(Math.abs(pz), 0.02)} transform={`rotate(${tilt + 90})`} fill="none" stroke={color(n)} strokeWidth={R * 1.1} />
        </g>
      )}
      {disc}
      <circle r={R} fill={`url(#${clip}-shine)`} />
    </g>
  );
}

// An Aura halo pressed into the felt: a tilted ring, tone on tone, lit from
// the top left (a dark groove with a light lip below it)
function EngravedHalo() {
  const ring = { cx: W / 2, cy: H / 2, rx: 210, ry: 74 };
  return (
    <g pointerEvents="none" transform={`rotate(-12 ${W / 2} ${H / 2})`} opacity="0.9">
      <ellipse {...ring} fill="none" stroke="#06322e" strokeOpacity="0.55" strokeWidth={26} />
      <ellipse {...ring} cy={ring.cy + 3} fill="none" stroke="#3fb3a5" strokeOpacity="0.22" strokeWidth={18} />
      <ellipse {...ring} cy={ring.cy - 2} fill="none" stroke="#0a3d38" strokeOpacity="0.6" strokeWidth={14} />
      <text x={W / 2} y={H / 2 + 150} textAnchor="middle" fontSize={64} fontStyle="italic" fontWeight="700" letterSpacing="6"
        fill="#0a3d38" fillOpacity="0.55" stroke="#3fb3a5" strokeOpacity="0.18" strokeWidth={2} fontFamily="Fraunces, Georgia, serif">AURA</text>
    </g>
  );
}

function GroupBalls({ group, balls }) {
  if (!group) return <span className="text-[11px] text-[var(--text-muted)]">Open table</span>;
  return (
    <span className="flex gap-0.5" aria-label={`${group}, ${GROUP[group].filter(n => balls[n]).length} left`}>
      {GROUP[group].map(n => (
        <span key={n} className={`w-3.5 h-3.5 rounded-full border border-black/30 ${balls[n] ? '' : 'opacity-20'}`}
          style={{ background: n > 8 ? `linear-gradient(#f6f3ea 25%, ${color(n)} 25% 75%, #f6f3ea 75%)` : color(n) }} />
      ))}
    </span>
  );
}

// The rubber cushions, with gaps at each pocket and angled ends
function Cushions() {
  const c = CUSHION, cm = CORNER_MOUTH, sm = SIDE_MOUTH;
  const strips = [
    `M ${cm} 0 L ${W - cm} 0 L ${W - cm - c} ${-c} L ${cm + c} ${-c} Z`,                       // top
    `M ${cm} ${H} L ${W - cm} ${H} L ${W - cm - c} ${H + c} L ${cm + c} ${H + c} Z`,           // bottom
    `M 0 ${cm} L 0 ${H / 2 - sm} L ${-c} ${H / 2 - sm - c * 0.6} L ${-c} ${cm + c} Z`,          // left, upper
    `M 0 ${H / 2 + sm} L 0 ${H - cm} L ${-c} ${H - cm - c} L ${-c} ${H / 2 + sm + c * 0.6} Z`, // left, lower
    `M ${W} ${cm} L ${W} ${H / 2 - sm} L ${W + c} ${H / 2 - sm - c * 0.6} L ${W + c} ${cm + c} Z`,
    `M ${W} ${H / 2 + sm} L ${W} ${H - cm} L ${W + c} ${H - cm - c} L ${W + c} ${H / 2 + sm + c * 0.6} Z`,
  ];
  return (
    <g>
      {strips.map((d, i) => <path key={i} d={d} fill="#0f5c55" stroke="#083b37" strokeWidth={2} />)}
    </g>
  );
}

// Where the tip hits the cue ball: tap or drag on it; the dot shows the spot
function SpinPicker({ spin, setSpin, disabled }) {
  const ref = useRef(null);
  const set = e => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    let x = ((e.clientX - box.left) / box.width) * 2 - 1;
    let y = -(((e.clientY - box.top) / box.height) * 2 - 1);
    const m = Math.hypot(x, y);
    if (m > 0.85) { x *= 0.85 / m; y *= 0.85 / m; }
    if (Math.hypot(x, y) < 0.12) { x = 0; y = 0; }
    setSpin([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
  };
  const name = spin[1] > 0.2 ? 'Follow' : spin[1] < -0.2 ? 'Draw' : '';
  const sideName = spin[0] > 0.2 ? 'right' : spin[0] < -0.2 ? 'left' : '';
  const label = [name, sideName && `${sideName} english`].filter(Boolean).join(', ') || 'Centre ball';
  return (
    <div className="flex flex-col items-center gap-1">
      <div ref={ref} role="slider" tabIndex={disabled ? -1 : 0} aria-label="Spin: where the tip hits the cue ball" aria-valuetext={label}
        aria-valuemin={-1} aria-valuemax={1} aria-valuenow={spin[1]}
        className={`relative w-14 h-14 rounded-full cursor-crosshair select-none ${disabled ? 'opacity-50' : ''}`}
        style={{ background: 'radial-gradient(circle at 35% 30%, #ffffff, #ece7da 55%, #b9b2a2)', touchAction: 'none', boxShadow: 'inset 0 -3px 6px rgba(0,0,0,.25)' }}
        onPointerDown={e => { if (disabled) return; e.currentTarget.setPointerCapture?.(e.pointerId); set(e); }}
        onPointerMove={e => { if (!disabled && e.buttons) set(e); }}
        onKeyDown={e => {
          const step = { ArrowUp: [0, 0.2], ArrowDown: [0, -0.2], ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0] }[e.key];
          if (!step) return;
          e.preventDefault();
          let [x, y] = [spin[0] + step[0], spin[1] + step[1]];
          const m = Math.hypot(x, y);
          if (m > 0.85) { x *= 0.85 / m; y *= 0.85 / m; }
          setSpin([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
        }}>
        <span className="absolute left-1/2 top-1 bottom-1 w-px bg-black/15" aria-hidden="true" />
        <span className="absolute top-1/2 left-1 right-1 h-px bg-black/15" aria-hidden="true" />
        <span className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-red-500 border border-white shadow" aria-hidden="true"
          style={{ left: `${50 + spin[0] * 50}%`, top: `${50 - spin[1] * 50}%` }} />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{label}</span>
    </div>
  );
}

const TARGET_TEXT = {
  break: 'Break! Aim at the rack and pull the cue back hard.',
  open: 'Open table: pot any ball but the 8 to claim its group.',
  solids: 'Hit one of your solids first.',
  stripes: 'Hit one of your stripes first.',
  eight: 'All yours are down. Sink the 8 to win.',
};

export default function PoolTable({ view, seat, players, move, busy, myTurn }) {
  const clip = `pool${useId().replace(/:/g, '')}`;
  const svg = useRef(null);
  const bar = useRef(null);
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(view.target === 'break' ? 1 : 0.55);
  const [spin, setSpin] = useState([0, 0]);
  const [pull, setPull] = useState(null);             // power while the stick is being pulled back
  const [place, setPlace] = useState(null);           // where they've put the cue ball (ball in hand)
  const [placing, setPlacing] = useState(!view.balls[0]);
  const [frame, setFrame] = useState(null);           // positions while a shot plays back
  const [strike, setStrike] = useState(false);        // the stick snapping forward
  const drag = useRef(null);                          // { mode: 'aim' | 'pull' | 'bar', start }
  const raf = useRef(0);
  const seen = useRef(view.shot?.no ?? null);
  const recording = useRef(view.shot?.frames ? view.shot.frames : null);

  const play = useCallback(frames => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const tick = now => {
      const at = Math.max(0, (now - start) / FRAME_MS);   // the first callback can be stamped just before start
      const i = Math.floor(at);
      if (i >= frames.length - 1) { setFrame(null); return; }
      const a = frames[i], b = frames[i + 1], f = at - i;
      const pos = [];
      for (let n = 0; n < 16; n++) {
        const x = a[2 * n], y = a[2 * n + 1];
        if (x < 0) { pos.push(null); continue; }
        const bx = b[2 * n], by = b[2 * n + 1];
        pos.push(bx < 0 ? [x, y] : [x + (bx - x) * f, y + (by - y) * f]);
      }
      setFrame(pos);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // A new shot (ours from the move, theirs from a poll) plays back once
  const shot = view.shot;
  useEffect(() => {
    if (!shot) return;
    if (shot.frames) recording.current = shot.frames;
    if (seen.current === shot.no) return;
    seen.current = shot.no;
    setStrike(false);
    if (shot.frames) play(shot.frames);
  }, [shot?.no]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fresh turn: forget a placement and spin from the last one
  useEffect(() => {
    setPlace(null);
    setSpin([0, 0]);
    setPlacing(myTurn && view.hand && !view.balls[0]);
    if (view.target === 'break') setPower(1);
  }, [view.shots, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // If a shot didn't go through, bring the stick back
  useEffect(() => {
    if (busy || !strike) return undefined;
    const t = setTimeout(() => setStrike(false), 600);
    return () => clearTimeout(t);
  }, [busy, strike]);

  const playing = frame !== null;
  const canShoot = myTurn && !busy && !playing && !view.over;
  const balls = playing ? frame : view.balls;
  const shown = balls.map((b, n) => (n === 0 && place && !playing ? place : b));
  const poles = useRolling(shown);
  const cue = shown[0];
  const path = canShoot && cue && !placing ? aimPath(shown, cue, angle, spin[1]) : null;
  const showStick = (path || strike) && cue;
  const shownPower = pull ?? power;

  function point(e) {
    const el = svg.current;
    const ctm = el?.getScreenCTM?.();
    if (!ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }
  // How far behind the cue ball (along the stick) a point is, and how far off the stick's line
  function alongStick(p) {
    const back = [-Math.cos(angle), -Math.sin(angle)];
    const m = [p[0] - cue[0], p[1] - cue[1]];
    return { along: m[0] * back[0] + m[1] * back[1], off: Math.abs(m[0] * back[1] - m[1] * back[0]) };
  }

  function shoot(withPower = power) {
    const m = { angle: Math.round(angle * 1e6) / 1e6, power: Math.round(withPower * 100) / 100 };
    if (spin[0] || spin[1]) m.spin = spin;
    if (view.hand && place) m.cue = place;
    setPower(withPower);
    setStrike(true);
    move(m);
  }

  function down(e) {
    if (!canShoot) return;
    const p = point(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (placing) { drag.current = { mode: 'place' }; placeAt(p); return; }
    if (!cue) return;
    const s = alongStick(p);
    // On the stick (behind the cue ball, near its line): pull it back
    if (s.along > R && s.along < TIP_GAP + STICK && s.off < 70) {
      drag.current = { mode: 'pull', start: s.along };
      setPull(0);
      return;
    }
    drag.current = { mode: 'aim' };
    setAngle(Math.atan2(p[1] - cue[1], p[0] - cue[0]));
  }
  function placeAt(p) {
    const x = Math.min(W - R, Math.max(R, p[0]));
    const y = Math.min(H - R, Math.max(view.kitchen ? HEAD_LINE : R, p[1]));
    if (spotFree(view.balls, x, y, view.kitchen)) setPlace([Math.round(x), Math.round(y)]);
  }
  function moveTo(e) {
    const d = drag.current;
    if (!d || !canShoot) return;
    const p = point(e);
    if (!p) return;
    if (d.mode === 'place') placeAt(p);
    else if (d.mode === 'aim') setAngle(Math.atan2(p[1] - cue[1], p[0] - cue[0]));
    else if (d.mode === 'pull') setPull(Math.max(0, Math.min(1, (alongStick(p).along - d.start) / MAX_PULL)));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'place' && place) setPlacing(false);
    if (d?.mode === 'pull' || d?.mode === 'bar') release();
  }
  // Letting go of a pulled stick shoots; a pull of almost nothing cancels
  function release() {
    const p = pull;
    setPull(null);
    if (p !== null && p >= 0.03 && canShoot) shoot(p);
  }

  // The power bar beside the table: pull its handle down, let go to shoot
  function barPower(e) {
    const box = bar.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.max(0, Math.min(1, (e.clientY - box.top - drag.current.start) / (box.height * 0.8)));
  }

  const groups = view.groups ?? [null, null];
  const label = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const stickBack = strike ? -10 : TIP_GAP + shownPower * MAX_PULL;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-xs">
        {[0, 1].map(s => (
          <div key={s} className={`flex flex-col gap-1 px-2.5 py-2 rounded-xl border ${view.turn === s ? 'border-aura-500/50 bg-aura-500/10' : 'border-[var(--border)]'}`}>
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {label(s)}{groups[s] && <span className="font-normal text-[var(--text-muted)]"> · {groups[s]}</span>}
            </span>
            <GroupBalls group={groups[s]} balls={view.balls} />
          </div>
        ))}
      </div>

      {myTurn && !view.over && (
        <p className="text-sm text-[var(--text-secondary)] text-center" aria-live="polite">
          {placing
            ? `Ball in hand: tap the table to place the cue ball${view.kitchen ? ' below the line' : ''}.`
            : TARGET_TEXT[view.target] ?? ''}
        </p>
      )}

      <div className="flex items-stretch justify-center gap-2 w-full">
        <svg ref={svg} viewBox={`${-RAIL} ${-RAIL} ${W + 2 * RAIL} ${H + 2 * RAIL}`} role="img"
          aria-label={`Pool table, ${view.balls.slice(1).filter(Boolean).length} balls left on it`}
          className="flex-1 min-w-0 select-none" style={{ maxWidth: `calc(70vh * ${(W + 2 * RAIL) / (H + 2 * RAIL)})`, touchAction: canShoot ? 'none' : 'auto' }}
          onPointerDown={down} onPointerMove={moveTo} onPointerUp={up} onPointerCancel={() => { drag.current = null; setPull(null); }}>
          <defs>
            <clipPath id={clip}><circle r={R} /></clipPath>
            <radialGradient id={`${clip}-shine`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
            </radialGradient>
            <linearGradient id={`${clip}-rail`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4a2a3f" />
              <stop offset="50%" stopColor="#2b1830" />
              <stop offset="100%" stopColor="#1a0f22" />
            </linearGradient>
            <linearGradient id={`${clip}-cue`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f5f0e6" />
              <stop offset="3%" stopColor="#3b82f6" />
              <stop offset="5%" stopColor="#f3e7cf" />
              <stop offset="62%" stopColor="#d9b98a" />
              <stop offset="64%" stopColor="#1f1a17" />
              <stop offset="70%" stopColor="var(--brand-2)" />
              <stop offset="72%" stopColor="#1f1a17" />
              <stop offset="100%" stopColor="#3a2418" />
            </linearGradient>
            <radialGradient id={`${clip}-pocket`}>
              <stop offset="55%" stopColor="#020205" />
              <stop offset="100%" stopColor="#1d1426" />
            </radialGradient>
            <radialGradient id={`${clip}-felt`} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#1b7a70" />
              <stop offset="100%" stopColor="#0d4f4a" />
            </radialGradient>
          </defs>
          <rect x={-RAIL} y={-RAIL} width={W + 2 * RAIL} height={H + 2 * RAIL} rx={44} fill={`url(#${clip}-rail)`} />
          <rect x={-RAIL + 10} y={-RAIL + 10} width={W + 2 * RAIL - 20} height={H + 2 * RAIL - 20} rx={36} fill="none" stroke="var(--brand-2)" strokeOpacity="0.55" strokeWidth={4} />
          <rect x={-CUSHION} y={-CUSHION} width={W + 2 * CUSHION} height={H + 2 * CUSHION} fill="#0b403c" />
          <rect x={0} y={0} width={W} height={H} fill={`url(#${clip}-felt)`} />
          <Cushions />
          {[0.25, 0.5, 0.75].map(f => (
            <g key={f} fill="#cbb8ef" opacity="0.7">
              <circle cx={W * f} cy={-RAIL / 2 - 4} r={5} /><circle cx={W * f} cy={H + RAIL / 2 + 4} r={5} />
            </g>
          ))}
          {[0.125, 0.25, 0.375, 0.625, 0.75, 0.875].map(f => (
            <g key={f} fill="#cbb8ef" opacity="0.7">
              <circle cx={-RAIL / 2 - 4} cy={H * f} r={5} /><circle cx={W + RAIL / 2 + 4} cy={H * f} r={5} />
            </g>
          ))}
          <EngravedHalo />
          <line x1={0} y1={HEAD_LINE} x2={W} y2={HEAD_LINE} stroke="#fff" strokeOpacity="0.15" strokeWidth={3} />
          <circle cx={W / 2} cy={500} r={5} fill="#fff" fillOpacity="0.25" />
          {POCKETS.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={(i === 2 || i === 3 ? 40 : 46) + 7} fill="#120a18" />
              <circle cx={x} cy={y} r={i === 2 || i === 3 ? 40 : 46} fill={`url(#${clip}-pocket)`} />
            </g>
          ))}

          {path && (
            <g pointerEvents="none">
              <line x1={cue[0]} y1={cue[1]} x2={path.end[0]} y2={path.end[1]} stroke="#fff" strokeOpacity="0.55" strokeWidth={4} strokeDasharray="14 12" />
              {path.ghost && (
                <>
                  <circle cx={path.ghost[0]} cy={path.ghost[1]} r={R} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth={3} />
                  <line x1={shown[path.hit][0]} y1={shown[path.hit][1]}
                    x2={shown[path.hit][0] + path.objectDir[0] * 220 * Math.max(0.3, path.dot)} y2={shown[path.hit][1] + path.objectDir[1] * 220 * Math.max(0.3, path.dot)}
                    stroke="#fde68a" strokeOpacity="0.85" strokeWidth={4} />
                  {path.cueDir && (
                    <line x1={path.ghost[0]} y1={path.ghost[1]}
                      x2={path.ghost[0] + path.cueDir[0] * 170 * Math.max(0.35, path.cueLen)} y2={path.ghost[1] + path.cueDir[1] * 170 * Math.max(0.35, path.cueLen)}
                      stroke="#fff" strokeOpacity="0.35" strokeWidth={3} strokeDasharray="8 8" />
                  )}
                </>
              )}
            </g>
          )}
          {shown.map((b, n) => (b ? <Ball key={n} n={n} x={b[0]} y={b[1]} clip={clip} pole={poles[n]} /> : null))}
          {showStick && (
            <g pointerEvents="none" transform={`translate(${cue[0]} ${cue[1]}) rotate(${(angle * 180) / Math.PI + 180})`}
              style={{ opacity: strike ? 0 : 1, transition: strike ? 'opacity .35s ease .12s' : 'none' }}>
              <g style={{ transform: `translateX(${stickBack}px)`, transition: strike ? 'transform .1s cubic-bezier(.6, 0, 1, 1)' : pull !== null ? 'none' : 'transform .15s ease' }}>
                <rect x={0} y={-8} width={STICK} height={16} rx={8} fill={`url(#${clip}-cue)`} opacity="0.95" />
                <rect x={0} y={-8} width={STICK} height={16} rx={8} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth={2} />
              </g>
            </g>
          )}
          {placing && myTurn && view.kitchen && (
            <rect x={0} y={HEAD_LINE} width={W} height={H - HEAD_LINE} fill="#fff" fillOpacity="0.06" pointerEvents="none" />
          )}
        </svg>

        {canShoot && !placing && cue && (
          <div ref={bar} className="relative w-9 flex-shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden select-none"
            style={{ touchAction: 'none' }} aria-hidden="true"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              const box = bar.current.getBoundingClientRect();
              drag.current = { mode: 'bar', start: Math.min(e.clientY - box.top, box.height * 0.2) };
              setPull(0);
            }}
            onPointerMove={e => { if (drag.current?.mode === 'bar') setPull(barPower(e)); }}
            onPointerUp={up}
            onPointerCancel={() => { drag.current = null; setPull(null); }}>
            <div className="absolute inset-x-0 top-0 transition-[height] duration-75"
              style={{ height: `${(pull ?? 0) * 100}%`, background: 'linear-gradient(180deg, #22c55e, #facc15 55%, #ef4444)' }} />
            <div className="absolute left-1/2 -translate-x-1/2 w-2.5 rounded-full shadow"
              style={{ top: `calc(${(pull ?? 0) * 80}% + 6px)`, height: '20%', background: 'linear-gradient(180deg, #f3e7cf, #d9b98a 70%, #3a2418)' }} />
            <span className="absolute bottom-1.5 inset-x-0 text-center text-[9px] font-bold text-[var(--text-muted)]">PULL</span>
          </div>
        )}
      </div>

      {canShoot && (
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {view.hand && (
            <button type="button" onClick={() => setPlacing(p => !p)}
              className={`btn-secondary py-1.5 text-sm text-[var(--text-primary)] ${placing ? 'ring-2 ring-aura-400' : ''}`}>
              <Move size={15} aria-hidden="true" /> {placing ? 'Done placing' : 'Move the cue ball'}
            </button>
          )}
          {!placing && cue && (
            <>
              <p className="text-[11px] text-[var(--text-muted)] text-center">
                Drag on the table to aim. Pull the cue stick (or the bar) back and let go to shoot.
              </p>
              <div className="flex items-center gap-3">
                <SpinPicker spin={spin} setSpin={setSpin} disabled={!canShoot} />
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setAngle(a => a - FINE)} aria-label="Aim a little left" className="btn-ghost p-1.5"><ChevronLeft size={18} /></button>
                    <label className="flex-1 flex flex-col gap-0.5 text-xs text-[var(--text-muted)]">
                      <span className="flex justify-between"><span>Power</span><span className="tabular-nums">{Math.round(shownPower * 100)}%</span></span>
                      <input type="range" min={0} max={100} step={1} value={Math.round(power * 100)} aria-label="Power"
                        onChange={e => setPower(Number(e.target.value) / 100)} className="w-full accent-[var(--accent)]" />
                    </label>
                    <button type="button" onClick={() => setAngle(a => a + FINE)} aria-label="Aim a little right" className="btn-ghost p-1.5"><ChevronRight size={18} /></button>
                  </div>
                  <button type="button" onClick={() => shoot()} className="btn-primary py-1.5">Shoot</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!playing && recording.current && (
        <button type="button" onClick={() => play(recording.current)} className="btn-ghost text-xs">
          <RotateCcw size={13} aria-hidden="true" /> Replay the last shot
        </button>
      )}
    </div>
  );
}
