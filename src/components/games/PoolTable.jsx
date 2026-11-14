import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Move, RotateCcw } from 'lucide-react';

// 8-Ball Pool. The server runs every shot (backend/lambdas/aura-aura/pool.mjs)
// and sends back a recording; this table only aims, places the cue ball when
// it's in hand, and plays the recording back. Table sizes match pool.mjs
// (a test keeps them equal).
export const W = 1000;
export const H = 2000;
export const R = 22;
export const HEAD_LINE = 1500;
const RAIL = 62;
const FRAME_MS = 50;      // the server records 20 frames a second
const POCKETS = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const COLORS = { 1: '#f2c230', 2: '#2457d6', 3: '#d63333', 4: '#6c35a8', 5: '#f07d1a', 6: '#1d8a45', 7: '#8a2525', 8: '#121212' };
const color = n => COLORS[n > 8 ? n - 8 : n];
const GROUP = { solids: [1, 2, 3, 4, 5, 6, 7], stripes: [9, 10, 11, 12, 13, 14, 15] };
const FINE = Math.PI / 900;   // a fine-aim nudge: 0.2°

function spotFree(balls, x, y, kitchen) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  if (kitchen && y < HEAD_LINE) return false;
  return balls.every((b, n) => n === 0 || !b || Math.hypot(b[0] - x, b[1] - y) >= 2 * R + 0.5);
}

// Where the aim line from the cue ball first meets a ball (as a ghost ball) or a cushion
function aimPath(balls, cue, angle) {
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
  return { end: ghost, hit, ghost, objectDir: n, cueDir: tangent, dot };
}

function Ball({ n, x, y, clip }) {
  if (n === 0) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={R} fill="#f6f3ea" />
        <circle r={R} fill={`url(#${clip}-shine)`} />
      </g>
    );
  }
  const stripe = n > 8;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={R} fill={stripe ? '#f6f3ea' : color(n)} />
      {stripe && <rect x={-R} y={-R * 0.56} width={2 * R} height={R * 1.12} fill={color(n)} clipPath={`url(#${clip})`} />}
      <circle r={R * 0.5} fill="#f6f3ea" />
      <text y={6} textAnchor="middle" fontSize={n > 9 ? 15 : 17} fontWeight="700" fill="#141414" fontFamily="system-ui, sans-serif">{n}</text>
      <circle r={R} fill={`url(#${clip}-shine)`} />
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

const TARGET_TEXT = {
  break: 'Break! Aim at the rack and hit it hard.',
  open: 'Open table: pot any ball but the 8 to claim its group.',
  solids: 'Hit one of your solids first.',
  stripes: 'Hit one of your stripes first.',
  eight: 'All yours are down. Sink the 8 to win.',
};

export default function PoolTable({ view, seat, players, move, busy, myTurn }) {
  const clip = `pool${useId().replace(/:/g, '')}`;
  const svg = useRef(null);
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(view.target === 'break' ? 1 : 0.55);
  const [place, setPlace] = useState(null);          // where they've put the cue ball (ball in hand)
  const [placing, setPlacing] = useState(!view.balls[0]);
  const [frame, setFrame] = useState(null);           // positions while a shot plays back
  const dragging = useRef(false);
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
    if (shot.frames) play(shot.frames);
  }, [shot?.no]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fresh turn: forget a placement from the last one
  useEffect(() => {
    setPlace(null);
    setPlacing(myTurn && view.hand && !view.balls[0]);
    if (view.target === 'break') setPower(1);
  }, [view.shots, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = frame !== null;
  const canShoot = myTurn && !busy && !playing && !view.over;
  const balls = playing ? frame : view.balls;
  const shown = balls.map((b, n) => (n === 0 && place && !playing ? place : b));
  const cue = shown[0];
  const path = canShoot && cue && !placing ? aimPath(shown, cue, angle) : null;

  function point(e) {
    const el = svg.current;
    const ctm = el?.getScreenCTM?.();
    if (!ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }
  function pointer(e) {
    if (!canShoot) return;
    const p = point(e);
    if (!p) return;
    if (placing) {
      const x = Math.min(W - R, Math.max(R, p[0]));
      const y = Math.min(H - R, Math.max(view.kitchen ? HEAD_LINE : R, p[1]));
      if (spotFree(view.balls, x, y, view.kitchen)) setPlace([Math.round(x), Math.round(y)]);
      return;
    }
    if (cue) setAngle(Math.atan2(p[1] - cue[1], p[0] - cue[0]));
  }

  function shoot() {
    const m = { angle: Math.round(angle * 1e6) / 1e6, power: Math.round(power * 100) / 100 };
    if (view.hand && place) m.cue = place;
    move(m);
  }

  const groups = view.groups ?? [null, null];
  const label = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');

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

      <svg ref={svg} viewBox={`${-RAIL} ${-RAIL} ${W + 2 * RAIL} ${H + 2 * RAIL}`} role="img"
        aria-label={`Pool table, ${view.balls.slice(1).filter(Boolean).length} balls left on it`}
        className="w-full select-none" style={{ maxWidth: `calc(70vh * ${(W + 2 * RAIL) / (H + 2 * RAIL)})`, touchAction: canShoot ? 'none' : 'auto' }}
        onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pointer(e); }}
        onPointerMove={e => { if (dragging.current) pointer(e); }}
        onPointerUp={() => { dragging.current = false; if (placing && place) setPlacing(false); }}
        onPointerCancel={() => { dragging.current = false; }}>
        <defs>
          <clipPath id={clip}><circle r={R} /></clipPath>
          <radialGradient id={`${clip}-shine`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
          </radialGradient>
          <radialGradient id={`${clip}-felt`} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#1b7a70" />
            <stop offset="100%" stopColor="#0d4f4a" />
          </radialGradient>
        </defs>
        <rect x={-RAIL} y={-RAIL} width={W + 2 * RAIL} height={H + 2 * RAIL} rx={44} fill="#2b2040" />
        <rect x={-RAIL + 10} y={-RAIL + 10} width={W + 2 * RAIL - 20} height={H + 2 * RAIL - 20} rx={36} fill="none" stroke="#4a3a66" strokeWidth={4} />
        <rect x={-14} y={-14} width={W + 28} height={H + 28} fill="#0b403c" />
        <rect x={0} y={0} width={W} height={H} fill={`url(#${clip}-felt)`} />
        {[0.25, 0.5, 0.75].map(f => (
          <g key={f} fill="#cbb8ef" opacity="0.7">
            <circle cx={W * f} cy={-RAIL / 2} r={5} /><circle cx={W * f} cy={H + RAIL / 2} r={5} />
          </g>
        ))}
        {[0.125, 0.25, 0.375, 0.625, 0.75, 0.875].map(f => (
          <g key={f} fill="#cbb8ef" opacity="0.7">
            <circle cx={-RAIL / 2} cy={H * f} r={5} /><circle cx={W + RAIL / 2} cy={H * f} r={5} />
          </g>
        ))}
        <line x1={0} y1={HEAD_LINE} x2={W} y2={HEAD_LINE} stroke="#fff" strokeOpacity="0.15" strokeWidth={3} />
        <circle cx={W / 2} cy={500} r={5} fill="#fff" fillOpacity="0.25" />
        {POCKETS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 || i === 3 ? 40 : 46} fill="#05060a" />)}

        {path && (
          <g pointerEvents="none">
            <line x1={cue[0]} y1={cue[1]} x2={path.end[0]} y2={path.end[1]} stroke="#fff" strokeOpacity="0.55" strokeWidth={4} strokeDasharray="14 12" />
            {path.ghost && (
              <>
                <circle cx={path.ghost[0]} cy={path.ghost[1]} r={R} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth={3} />
                <line x1={shown[path.hit][0]} y1={shown[path.hit][1]}
                  x2={shown[path.hit][0] + path.objectDir[0] * 200 * Math.max(0.3, path.dot)} y2={shown[path.hit][1] + path.objectDir[1] * 200 * Math.max(0.3, path.dot)}
                  stroke="#fde68a" strokeOpacity="0.8" strokeWidth={4} />
                <line x1={path.ghost[0]} y1={path.ghost[1]}
                  x2={path.ghost[0] + path.cueDir[0] * 150} y2={path.ghost[1] + path.cueDir[1] * 150}
                  stroke="#fff" strokeOpacity="0.3" strokeWidth={3} />
              </>
            )}
          </g>
        )}
        {shown.map((b, n) => (b ? <Ball key={n} n={n} x={b[0]} y={b[1]} clip={clip} /> : null))}
        {placing && myTurn && view.kitchen && (
          <rect x={0} y={HEAD_LINE} width={W} height={H - HEAD_LINE} fill="#fff" fillOpacity="0.06" pointerEvents="none" />
        )}
      </svg>

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
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAngle(a => a - FINE)} aria-label="Aim a little left" className="btn-ghost p-2"><ChevronLeft size={18} /></button>
                <label className="flex-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                  <span className="flex justify-between"><span>Power</span><span className="tabular-nums">{Math.round(power * 100)}%</span></span>
                  <input type="range" min={0} max={100} step={1} value={Math.round(power * 100)} aria-label="Power"
                    onChange={e => setPower(Number(e.target.value) / 100)} className="w-full accent-[var(--accent)]" />
                </label>
                <button type="button" onClick={() => setAngle(a => a + FINE)} aria-label="Aim a little right" className="btn-ghost p-2"><ChevronRight size={18} /></button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] text-center">Drag on the table to aim; the arrows fine-tune it.</p>
              <button type="button" onClick={shoot} className="btn-primary">Shoot</button>
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
