import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import './games.css';

// Mini golf. The server builds each random hole and runs every stroke
// (backend/lambdas/aura-aura/golf.mjs); this draws the course, aims, and
// plays the stroke back. Sizes match golf.mjs (a test keeps them equal).
//
// Aiming is a slingshot: press anywhere, drag back away from where you want
// the ball to go, and let go. The further you pull, the harder the putt; a
// tiny pull cancels. The slider and Putt button do the same from a keyboard.
export const W = 1000;
export const H = 1500;
export const T = 125;
export const COLS = 8;
export const BALL = 11;
export const CUP = 19;
const MARGIN = 30;
const FRAME_MS = 50;
const MAX_DRAG = 380;        // dragging this far is full power
const FINE = Math.PI / 360;
const BALL_COLORS = ['#ffffff', '#fde047', '#f472b6', '#67e8f9'];
const SLOPE_DIR = { U: 270, D: 90, L: 180, R: 0 };

function Tile({ c, r, kind, clip }) {
  const x = c * T, y = r * T;
  if (kind === '.') return null;
  const stripe = r % 2 === 0 ? '#3f9d4b' : '#45a852';
  if (kind === 's') return <rect x={x} y={y} width={T} height={T} fill={`url(#${clip}-sand)`} />;
  if (kind === 'i') return <rect x={x} y={y} width={T} height={T} fill={`url(#${clip}-ice)`} />;
  if (kind === 'w') {
    return (
      <g>
        <rect x={x} y={y} width={T} height={T} fill="#1f6fbf" />
        <path className="golf-ripple" d={`M ${x + 10} ${y + 40} q 15 -10 30 0 t 30 0 t 30 0 M ${x + 20} ${y + 80} q 15 -10 30 0 t 30 0`} stroke="#9fd2ff" strokeOpacity="0.6" strokeWidth="3" fill="none" />
      </g>
    );
  }
  if (SLOPE_DIR[kind] !== undefined) {
    return (
      <g>
        <rect x={x} y={y} width={T} height={T} fill={stripe} />
        <rect x={x} y={y} width={T} height={T} fill={`url(#${clip}-slope)`} opacity="0.35" />
        <g transform={`translate(${x + T / 2} ${y + T / 2}) rotate(${SLOPE_DIR[kind]})`} opacity="0.55">
          <g className="golf-chevrons">
            {[-30, 0, 30].map(o => <path key={o} d={`M ${o - 8} -14 L ${o + 6} 0 L ${o - 8} 14`} stroke="#eaffea" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          </g>
        </g>
      </g>
    );
  }
  return <rect x={x} y={y} width={T} height={T} fill={stripe} />;
}

export default function GolfCourse({ view, seat, players, move, busy, myTurn }) {
  const clip = `golf${useId().replace(/:/g, '')}`;
  const svg = useRef(null);
  // The last stroke of a hole plays back on that hole, not the next one
  const prevHole = useRef({ hole: view.hole, course: view.course });
  const [stale, setStale] = useState(null);
  const course = stale ?? view.course;
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(0.4);
  const [drag, setDrag] = useState(null);            // { power } while pulling back
  const [frame, setFrame] = useState(null);          // the moving ball during playback
  const raf = useRef(0);
  const seen = useRef(view.shot?.no ?? null);
  const last = useRef(view.shot ?? null);
  const pulling = useRef(false);

  const play = useCallback(shot => {
    cancelAnimationFrame(raf.current);
    const f = shot.frames;
    const count = f.length / 2;
    const start = performance.now();
    const tick = now => {
      const at = Math.max(0, (now - start) / FRAME_MS);
      const i = Math.floor(at);
      if (i >= count - 1) { setFrame(null); setStale(null); return; }
      const t = at - i;
      setFrame({ by: shot.by, pos: [f[2 * i] + (f[2 * i + 2] - f[2 * i]) * t, f[2 * i + 1] + (f[2 * i + 3] - f[2 * i + 1]) * t], end: i >= count - 3 ? shot : null });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const shot = view.shot;
  useEffect(() => {
    if (!shot) return;
    const moved = prevHole.current.hole !== view.hole;
    const before = prevHole.current.course;
    prevHole.current = { hole: view.hole, course: view.course };
    if (seen.current === shot.no) return;
    seen.current = shot.no;
    // a new hole: the stroke that finished the last one has no recording on this one
    if (moved && shot.by !== undefined && view.shot === shot && shot.frames) setStale(before);
    last.current = shot;
    play(shot);
  }, [shot?.no]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new turn: aim at the cup to start with
  const mineBall = seat !== null ? view.balls[seat] : null;
  useEffect(() => {
    if (myTurn && mineBall) setAngle(Math.atan2(course.cup[1] - mineBall[1], course.cup[0] - mineBall[0]));
  }, [myTurn, view.shots, view.hole]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = frame !== null;
  const canShoot = myTurn && !busy && !playing && !view.over && !!mineBall;
  const shownPower = drag?.power ?? power;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Player');

  function point(e) {
    const ctm = svg.current?.getScreenCTM?.();
    if (!ctm) return null;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }
  // The shot goes away from the finger, harder the further it's pulled
  function aimFrom(p) {
    const dx = mineBall[0] - p[0], dy = mineBall[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len > 4) setAngle(Math.atan2(dy, dx));
    setDrag({ power: Math.min(1, len / MAX_DRAG) });
  }
  function putt(withPower = power) {
    setPower(withPower);
    move({ angle: Math.round(angle * 1e6) / 1e6, power: Math.max(0.01, Math.round(withPower * 100) / 100) });
  }

  // Each ball: where it is now, or mid-stroke during playback
  const balls = view.balls.map((b, i) => {
    if (frame && frame.by === i) return frame.pos;
    if (stale) return null;
    if (playing && last.current?.by === i) return null;
    return b;
  });
  const arrowLen = 60 + shownPower * 260;
  const sum = (view.totals ?? []);
  const parTotal = (view.scores ?? []).length;
  // the flag pole, shortened when the cup sits near the top of the field
  const pole = Math.min(110, course.cup[1] + MARGIN - 12);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-semibold text-[var(--text-primary)]">Hole {view.hole + 1} of {view.holes}</span>
        <span className="text-[var(--text-secondary)]">Par {course.par}</span>
        {seat !== null && <span className="text-[var(--text-muted)]">Your strokes: {view.strokes[seat]}</span>}
      </div>

      <svg ref={svg} viewBox={`${-MARGIN} ${-MARGIN} ${W + 2 * MARGIN} ${H + 2 * MARGIN}`} role="img"
        aria-label={`Mini golf, hole ${view.hole + 1}, par ${course.par}`}
        className="w-full select-none rounded-2xl" style={{ maxWidth: `calc(72vh * ${(W + 2 * MARGIN) / (H + 2 * MARGIN)})`, touchAction: canShoot ? 'none' : 'auto' }}
        onPointerDown={e => { if (!canShoot) return; const p = point(e); if (!p) return; e.currentTarget.setPointerCapture?.(e.pointerId); pulling.current = true; aimFrom(p); }}
        onPointerMove={e => { if (!pulling.current || !canShoot) return; const p = point(e); if (p) aimFrom(p); }}
        onPointerUp={() => {
          if (!pulling.current) return;
          pulling.current = false;
          const p = drag?.power ?? 0;
          setDrag(null);
          if (p >= 0.04 && canShoot) putt(p);
        }}
        onPointerCancel={() => { pulling.current = false; setDrag(null); }}>
        <defs>
          <pattern id={`${clip}-rough`} width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#1d4a2a" />
            <path d="M 5 30 l 3 -8 M 25 12 l 2 -7 M 32 34 l 3 -7 M 14 20 l 2 -6" stroke="#2c6a3c" strokeWidth="2.5" strokeLinecap="round" />
          </pattern>
          <pattern id={`${clip}-sand`} width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#e7cf8f" />
            <circle cx="5" cy="6" r="1.6" fill="#c9ad66" /><circle cx="16" cy="15" r="1.4" fill="#c9ad66" /><circle cx="10" cy="20" r="1.2" fill="#f4e2ae" />
          </pattern>
          <linearGradient id={`${clip}-ice`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6f7ff" /><stop offset="50%" stopColor="#b9e3f5" /><stop offset="100%" stopColor="#d7f1fb" />
          </linearGradient>
          <linearGradient id={`${clip}-slope`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.5" /><stop offset="100%" stopColor="#fff" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id={`${clip}-ball`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" /><stop offset="100%" stopColor="#000" stopOpacity="0.25" />
          </radialGradient>
        </defs>
        <rect x={-MARGIN} y={-MARGIN} width={W + 2 * MARGIN} height={H + 2 * MARGIN} fill={`url(#${clip}-rough)`} />
        {Array.from({ length: course.tiles.length }, (_, k) => <Tile key={k} c={k % COLS} r={Math.floor(k / COLS)} kind={course.tiles[k]} clip={clip} />)}
        {/* the tee mat */}
        <rect x={course.tee[0] - 34} y={course.tee[1] - 22} width={68} height={44} rx={8} fill="#2f7d3b" stroke="#bfe8c4" strokeOpacity="0.5" strokeWidth={3} />
        {/* walls: a wooden rail with a highlight */}
        {course.walls.map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5b3a1e" strokeWidth={14} strokeLinecap="round" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a8743f" strokeWidth={6} strokeLinecap="round" />
          </g>
        ))}
        {course.bumpers.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y + 4} r={r} fill="#000" opacity="0.25" />
            <circle cx={x} cy={y} r={r} fill="#dc2626" />
            <circle cx={x} cy={y} r={r * 0.62} fill="#fff" />
            <circle cx={x} cy={y} r={r * 0.32} fill="#dc2626" />
          </g>
        ))}
        {/* the cup and its flag */}
        <circle cx={course.cup[0]} cy={course.cup[1]} r={CUP + 3} fill="#2b5e31" />
        <circle cx={course.cup[0]} cy={course.cup[1]} r={CUP} fill="#0b0f0b" />
        <g className="golf-flag" style={{ transformOrigin: `${course.cup[0]}px ${course.cup[1]}px` }}>
          <line x1={course.cup[0]} y1={course.cup[1]} x2={course.cup[0]} y2={course.cup[1] - pole} stroke="#f5f5f5" strokeWidth={5} />
          <path d={`M ${course.cup[0]} ${course.cup[1] - pole} l 52 16 l -52 16 Z`} fill="var(--brand-2)" />
        </g>

        {canShoot && (
          <g pointerEvents="none">
            <line x1={mineBall[0]} y1={mineBall[1]} x2={mineBall[0] + Math.cos(angle) * 900} y2={mineBall[1] + Math.sin(angle) * 900}
              stroke="#fff" strokeOpacity="0.25" strokeWidth={3} strokeDasharray="10 12" />
            <g transform={`translate(${mineBall[0]} ${mineBall[1]}) rotate(${(angle * 180) / Math.PI})`}>
              <line x1={BALL + 6} y1={0} x2={arrowLen} y2={0} stroke={`hsl(${120 - shownPower * 120} 85% 55%)`} strokeWidth={10} strokeLinecap="round" />
              <path d={`M ${arrowLen + 18} 0 L ${arrowLen - 4} -16 L ${arrowLen - 4} 16 Z`} fill={`hsl(${120 - shownPower * 120} 85% 55%)`} />
            </g>
          </g>
        )}
        {balls.map((b, i) => (b ? (
          <g key={i}>
            <circle cx={b[0] + 3} cy={b[1] + 4} r={BALL} fill="#000" opacity="0.3" />
            <circle cx={b[0]} cy={b[1]} r={BALL} fill={BALL_COLORS[i % 4]} stroke="#111" strokeOpacity="0.5" strokeWidth={2} />
            <circle cx={b[0]} cy={b[1]} r={BALL} fill={`url(#${clip}-ball)`} />
            {view.turn === i && !view.over && !playing && <circle cx={b[0]} cy={b[1]} r={BALL + 9} fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth={3} className="golf-ring" />}
          </g>
        ) : null))}
        {frame?.end?.water && <circle className="golf-splash" cx={frame.pos[0]} cy={frame.pos[1]} r={30} fill="none" stroke="#bfe3ff" strokeWidth={6} />}
      </svg>

      {drag && <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">Power {Math.round(drag.power * 100)}%</p>}

      {canShoot && !drag && (
        <div className="flex flex-col gap-2 w-full max-w-sm">
          <p className="text-[11px] text-[var(--text-muted)] text-center">Press and drag back, away from where the ball should go, then let go.</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setAngle(a => a - FINE * 4)} aria-label="Aim left" className="btn-ghost p-1.5"><ChevronLeft size={18} /></button>
            <label className="flex-1 flex flex-col gap-0.5 text-xs text-[var(--text-muted)]">
              <span className="flex justify-between"><span>Power</span><span className="tabular-nums">{Math.round(power * 100)}%</span></span>
              <input type="range" min={1} max={100} step={1} value={Math.round(power * 100)} aria-label="Power"
                onChange={e => setPower(Number(e.target.value) / 100)} className="w-full accent-[var(--accent)]" />
            </label>
            <button type="button" onClick={() => setAngle(a => a + FINE * 4)} aria-label="Aim right" className="btn-ghost p-1.5"><ChevronRight size={18} /></button>
          </div>
          <button type="button" onClick={() => putt()} className="btn-primary py-1.5">Putt</button>
        </div>
      )}

      {!playing && last.current?.frames && (
        <button type="button" onClick={() => play(last.current)} className="btn-ghost text-xs">
          <RotateCcw size={13} aria-hidden="true" /> Replay the last stroke
        </button>
      )}

      {/* The scorecard */}
      <div className="w-full max-w-md overflow-x-auto">
        <table className="w-full text-xs text-[var(--text-secondary)] tabular-nums">
          <thead>
            <tr className="text-[var(--text-muted)]">
              <th className="text-left font-semibold py-1 pr-2">Player</th>
              {Array.from({ length: view.holes }, (_, h) => <th key={h} className={`font-semibold px-1 ${h === view.hole && !view.over ? 'text-[var(--accent)]' : ''}`}>{h + 1}</th>)}
              <th className="font-semibold pl-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: view.n }, (_, i) => (
              <tr key={i} className={`border-t border-[var(--border)] ${view.out?.[i] ? 'opacity-40' : ''}`}>
                <td className="py-1 pr-2 text-left">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full border border-black/30 flex-shrink-0" style={{ background: BALL_COLORS[i % 4] }} aria-hidden="true" />
                    <span className="truncate max-w-[6rem]">{name(i)}</span>
                  </span>
                </td>
                {Array.from({ length: view.holes }, (_, h) => {
                  const done = view.scores[h]?.[i];
                  const now = h === view.hole && !view.over ? view.strokes[i] : null;
                  return <td key={h} className={`px-1 text-center ${h === view.hole && !view.over ? 'text-[var(--text-primary)] font-semibold' : ''}`}>{done ?? (now ? now : '–')}</td>;
                })}
                <td className="pl-2 text-center font-semibold text-[var(--text-primary)]">{sum[i] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parTotal > 0 && <p className="text-[11px] text-[var(--text-muted)] mt-1">Lowest total after hole {view.holes} wins.</p>}
      </div>
    </div>
  );
}
