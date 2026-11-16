import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import './games.css';

// Mini golf. The server builds each random hole and runs every stroke
// (backend/lambdas/aura-aura/golf.mjs); this draws the course, aims, and
// plays the stroke back. Sizes match golf.mjs (a test keeps them equal).
//
// Aiming: tap anywhere to point the ball there, or press anywhere and drag
// back like a slingshot and let go. The shot goes the opposite way to the
// drag, harder the further you pull; letting go with a tiny pull cancels.
// The arrows, slider and Putt button do the same from a keyboard.
export const W = 1000;
export const H = 1500;
export const T = 125;
export const COLS = 8;
export const BALL = 11;
export const CUP = 19;
const ROWS = H / T;
const FRAME_MS = 50;
const MAX_PULL = 330;        // pulling this far (in course units) is full power
const FINE = Math.PI / 360;
const RAIL = 20;             // rails sit just outside the course edge
const BALL_COLORS = ['#ffffff', '#fde047', '#f9a8d4', '#67e8f9'];
const SLOPE_DIR = { U: 270, D: 90, L: 180, R: 0 };
const ROUND = 30;            // corner radius of sand, water and ice patches
const PAD = 90;              // garden shown around the hole

// A small seeded random, so a course always gets the same scenery
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// A tile as a path, rounding each corner where it sticks out of its patch
function patchPath(x, y, s, round, grow = 0) {
  // round: [tl, tr, br, bl]; grow: push the outer sides out (for a rim)
  const [tl, tr, br, bl] = round.map(r => (r ? ROUND + grow : 0));
  const x0 = x - grow, y0 = y - grow, x1 = x + s + grow, y1 = y + s + grow;
  return `M ${x0 + tl} ${y0} H ${x1 - tr} ${tr ? `A ${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}` : ''} V ${y1 - br} ${br ? `A ${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}
    H ${x0 + bl} ${bl ? `A ${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''} V ${y0 + tl} ${tl ? `A ${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}` : ''} Z`;
}

// Everything about the course that only changes with the hole: the patches,
// the rails along its edge, and the garden around it
function useLayout(course) {
  return useMemo(() => {
    const kind = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? course.tiles[r * COLS + c] : '.');
    const on = (c, r) => kind(c, r) !== '.';
    const same = (k, c, r) => {
      const o = kind(c, r);
      if (k === 'w' || k === 's' || k === 'i') return o === k;
      return o !== '.';
    };
    const tiles = [];
    const edges = [];       // [x1, y1, x2, y2, nx, ny]: an edge of the course and the way out
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = kind(c, r);
      if (k === '.') continue;
      const round = [
        !same(k, c, r - 1) && !same(k, c - 1, r), !same(k, c, r - 1) && !same(k, c + 1, r),
        !same(k, c, r + 1) && !same(k, c + 1, r), !same(k, c, r + 1) && !same(k, c - 1, r),
      ];
      const grow = [!same(k, c, r - 1), !same(k, c + 1, r), !same(k, c, r + 1), !same(k, c - 1, r)];
      tiles.push({ c, r, k, x: c * T, y: r * T, round, grow });
      const x0 = c * T, y0 = r * T, x1 = x0 + T, y1 = y0 + T;
      if (!on(c, r - 1)) edges.push([x0, y0, x1, y0, 0, -1]);
      if (!on(c, r + 1)) edges.push([x0, y1, x1, y1, 0, 1]);
      if (!on(c - 1, r)) edges.push([x0, y0, x0, y1, -1, 0]);
      if (!on(c + 1, r)) edges.push([x1, y0, x1, y1, 1, 0]);
    }
    // join each straight run of edge into one rail, so the joints don't show
    const runs = new Map();
    for (const e of edges) {
      const k = e[4] ? `v${e[0]},${e[4]}` : `h${e[1]},${e[5]}`;
      if (!runs.has(k)) runs.set(k, []);
      runs.get(k).push(e);
    }
    const rails = [];
    for (const list of runs.values()) {
      const vertical = list[0][4] !== 0;
      list.sort((a, b) => (vertical ? a[1] - b[1] : a[0] - b[0]));
      for (const e of list) {
        const prev = rails[rails.length - 1];
        if (prev && prev[4] === e[4] && prev[5] === e[5] && prev[2] === e[0] && prev[3] === e[1]) { prev[2] = e[2]; prev[3] = e[3]; }
        else rails.push([...e]);
      }
    }
    // baffles: walls that aren't one of the course's edges
    const edge = new Set(edges.map(([a, b, c2, d]) => `${a},${b},${c2},${d}`));
    const baffles = course.walls.filter(([a, b, c2, d]) => !edge.has(`${a},${b},${c2},${d}`) && !edge.has(`${c2},${d},${a},${b}`));

    // The garden: bushes, flowers, rocks and the odd tree in the empty tiles
    const rnd = seeded(course.tiles + course.cup.join(','));
    const decor = [];
    for (let r = -2; r <= ROWS + 1; r++) for (let c = -2; c <= COLS + 1; c++) {
      if (on(c, r)) continue;
      const roll = rnd();
      const near = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => on(c + dc, r + dr));
      const cx = c * T + T / 2 + (rnd() - 0.5) * 40, cy = r * T + T / 2 + (rnd() - 0.5) * 40;
      if (roll < 0.22 && !near) decor.push({ type: 'tree', x: cx, y: cy, s: 44 + rnd() * 14, hue: rnd() });
      else if (roll < 0.5) decor.push({ type: 'bush', x: cx, y: cy, s: 22 + rnd() * 12, hue: rnd(), n: 3 + Math.floor(rnd() * 3), spin: rnd() * 6.28 });
      else if (roll < 0.68) decor.push({ type: 'flowers', x: cx, y: cy, hue: rnd(), dots: Array.from({ length: 6 }, () => [(rnd() - 0.5) * 70, (rnd() - 0.5) * 70]) });
      else if (roll < 0.78) decor.push({ type: 'rock', x: cx, y: cy, s: 14 + rnd() * 12, tilt: rnd() * 40 - 20 });
    }
    // The view: the hole itself with a border of garden, never too wide or too tall for a phone
    const xs = tiles.map(t => t.x), ys = tiles.map(t => t.y);
    let x0 = Math.min(...xs) - PAD, x1 = Math.max(...xs) + T + PAD;
    let y0 = Math.min(...ys) - PAD, y1 = Math.max(...ys) + T + PAD;
    const grow = (a, b, want) => { const extra = (want - (b - a)) / 2; return [a - extra, b + extra]; };
    if ((y1 - y0) / (x1 - x0) > 1.45) [x0, x1] = grow(x0, x1, (y1 - y0) / 1.45);
    if ((y1 - y0) / (x1 - x0) < 0.85) [y0, y1] = grow(y0, y1, (x1 - x0) * 0.85);
    return { tiles, rails, baffles, decor, box: [x0, y0, x1 - x0, y1 - y0] };
  }, [course]);
}

const FLOWER = ['#f472b6', '#fde047', '#ffffff', '#c084fc', '#fb923c'];

function Decor({ d }) {
  if (d.type === 'tree') {
    return (
      <g>
        <ellipse cx={d.x + 14} cy={d.y + 18} rx={d.s} ry={d.s * 0.8} fill="#000" opacity="0.22" />
        <circle cx={d.x} cy={d.y} r={d.s} fill={d.hue < 0.5 ? '#1f6b35' : '#246f3c'} />
        <circle cx={d.x - d.s * 0.3} cy={d.y - d.s * 0.3} r={d.s * 0.62} fill={d.hue < 0.5 ? '#2c8645' : '#318a4b'} />
        <circle cx={d.x - d.s * 0.42} cy={d.y - d.s * 0.42} r={d.s * 0.28} fill="#3fa05a" opacity="0.8" />
      </g>
    );
  }
  if (d.type === 'bush') {
    return (
      <g>
        {Array.from({ length: d.n }, (_, i) => {
          const a = d.spin + (i / d.n) * Math.PI * 2;
          const x = d.x + Math.cos(a) * d.s * 0.55, y = d.y + Math.sin(a) * d.s * 0.55;
          return (
            <g key={i}>
              <circle cx={x + 5} cy={y + 7} r={d.s * 0.7} fill="#000" opacity="0.18" />
              <circle cx={x} cy={y} r={d.s * 0.7} fill={d.hue < 0.5 ? '#2f7d3e' : '#3a8a3f'} />
              <circle cx={x - d.s * 0.2} cy={y - d.s * 0.22} r={d.s * 0.3} fill="#4ea457" opacity="0.8" />
            </g>
          );
        })}
      </g>
    );
  }
  if (d.type === 'flowers') {
    const color = FLOWER[Math.floor(d.hue * FLOWER.length)];
    return (
      <g>
        {d.dots.map(([dx, dy], i) => (
          <g key={i}>
            <circle cx={d.x + dx} cy={d.y + dy} r={6} fill={color} />
            <circle cx={d.x + dx} cy={d.y + dy} r={2.4} fill="#fbbf24" />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g transform={`rotate(${d.tilt} ${d.x} ${d.y})`}>
      <ellipse cx={d.x + 4} cy={d.y + 6} rx={d.s * 1.2} ry={d.s * 0.85} fill="#000" opacity="0.2" />
      <ellipse cx={d.x} cy={d.y} rx={d.s * 1.2} ry={d.s * 0.85} fill="#8b95a1" />
      <ellipse cx={d.x - d.s * 0.3} cy={d.y - d.s * 0.25} rx={d.s * 0.55} ry={d.s * 0.32} fill="#b4bcc6" />
    </g>
  );
}

function Patch({ t, id }) {
  const { x, y, k, round, grow } = t;
  const rim = (fill, g = 7) => {
    // the rim pokes out only on the sides that meet a different surface
    const [gt, gr, gb, gl] = grow.map(v => (v ? g : 0));
    const [tl, tr, br, bl] = round.map(r => (r ? ROUND + g : 0));
    const x0 = x - gl, y0 = y - gt, x1 = x + T + gr, y1 = y + T + gb;
    const d = `M ${x0 + tl} ${y0} H ${x1 - tr} ${tr ? `A ${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}` : ''} V ${y1 - br} ${br ? `A ${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}
      H ${x0 + bl} ${bl ? `A ${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''} V ${y0 + tl} ${tl ? `A ${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}` : ''} Z`;
    return <path d={d} fill={fill} />;
  };
  if (k === 's') return <g>{rim('#c9a35a')}<path d={patchPath(x, y, T, round)} fill={`url(#${id}-sand)`} /></g>;
  if (k === 'i') {
    return (
      <g>
        {rim('#8fd3ec')}
        <path d={patchPath(x, y, T, round)} fill={`url(#${id}-ice)`} />
        <path d={`M ${x + 22} ${y + 92} L ${x + 62} ${y + 40} M ${x + 58} ${y + 104} L ${x + 92} ${y + 62}`} stroke="#fff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
      </g>
    );
  }
  if (k === 'w') {
    return (
      <g>
        {rim('#7cc6ea', 8)}
        <path d={patchPath(x, y, T, round)} fill={`url(#${id}-water)`} />
        <path className="golf-ripple" d={`M ${x + 18} ${y + 42} q 15 -9 30 0 t 30 0 t 30 0 M ${x + 30} ${y + 84} q 15 -9 30 0 t 30 0`}
          stroke="#cfeaff" strokeOpacity="0.55" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (SLOPE_DIR[k] !== undefined) {
    return (
      <g>
        <rect x={x} y={y} width={T} height={T} fill={`url(#${id}-slope-${k})`} />
        <g transform={`translate(${x + T / 2} ${y + T / 2}) rotate(${SLOPE_DIR[k]})`} opacity="0.5">
          <g className="golf-chevrons">
            {[-32, 0, 32].map(o => <path key={o} d={`M ${o - 9} -15 L ${o + 6} 0 L ${o - 9} 15`} stroke="#f0fff0" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          </g>
        </g>
      </g>
    );
  }
  return null;
}

export default function GolfCourse({ view, seat, players, move, busy, myTurn }) {
  const id = `golf${useId().replace(/:/g, '')}`;
  const svg = useRef(null);
  // The last stroke of a hole plays back on that hole, not the next one
  const prevHole = useRef({ hole: view.hole, course: view.course });
  const [stale, setStale] = useState(null);
  const course = stale ?? view.course;
  const layout = useLayout(course);
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(0.4);
  const [pull, setPull] = useState(null);            // { power } while pulling back
  const [frame, setFrame] = useState(null);          // the moving ball during playback
  const raf = useRef(0);
  const seen = useRef(view.shot?.no ?? null);
  const last = useRef(view.shot ?? null);
  const press = useRef(null);                        // where the pull started (course units, and on screen)

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
      const trail = [];
      for (let k = Math.max(0, i - 7); k <= i; k++) trail.push([f[2 * k], f[2 * k + 1]]);
      setFrame({ by: shot.by, pos: [f[2 * i] + (f[2 * i + 2] - f[2 * i]) * t, f[2 * i + 1] + (f[2 * i + 3] - f[2 * i + 1]) * t], trail, end: i >= count - 3 ? shot : null });
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
    if (shot.frames) play(shot);
  }, [shot?.no]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new turn: aim at the cup to start with
  const mineBall = seat !== null ? view.balls[seat] : null;
  useEffect(() => {
    if (myTurn && mineBall) setAngle(Math.atan2(course.cup[1] - mineBall[1], course.cup[0] - mineBall[0]));
  }, [myTurn, view.shots, view.hole]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = frame !== null;
  const canShoot = myTurn && !busy && !playing && !view.over && !!mineBall && !stale;
  const shownPower = pull?.power ?? power;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Player');

  function point(e) {
    const ctm = svg.current?.getScreenCTM?.();
    if (!ctm) return null;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }
  function putt(withPower = power) {
    setPower(withPower);
    move({ angle: Math.round(angle * 1e6) / 1e6, power: Math.max(0.01, Math.round(withPower * 100) / 100) });
  }

  function down(e) {
    if (!canShoot) return;
    const p = point(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { at: p, screen: [e.clientX, e.clientY] };
  }
  function drag(e) {
    if (!press.current || !canShoot) return;
    const p = point(e);
    if (!p) return;
    // the shot goes from the finger back toward where the press started
    const dx = press.current.at[0] - p[0], dy = press.current.at[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (Math.hypot(e.clientX - press.current.screen[0], e.clientY - press.current.screen[1]) < 10) return;
    setAngle(Math.atan2(dy, dx));
    setPull({ power: Math.min(1, len / MAX_PULL) });
  }
  function up(e) {
    const started = press.current;
    press.current = null;
    if (!started) return;
    const p = pull?.power;
    setPull(null);
    if (p === undefined) {
      // a tap: aim at that spot
      const at = point(e);
      if (at && mineBall && canShoot) setAngle(Math.atan2(at[1] - mineBall[1], at[0] - mineBall[0]));
      return;
    }
    if (p >= 0.04 && canShoot) putt(p);
  }

  // Each ball: where it is now, or mid-stroke during playback
  const balls = view.balls.map((b, i) => {
    if (frame && frame.by === i) return frame.pos;
    if (stale) return null;
    if (playing && last.current?.by === i) return null;
    return b;
  });
  const sum = view.totals ?? [];
  const parTotal = (view.scores ?? []).length;
  const [cx, cy] = course.cup;
  // the flag pole, shortened when the cup sits near the top of the field
  const pole = Math.min(120, cy - layout.box[1] - 14);
  const aimLen = 70 + shownPower * 330;
  const aimColor = `hsl(${130 - shownPower * 125} 90% 58%)`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-semibold text-[var(--text-primary)]">Hole {view.hole + 1} of {view.holes}</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold">Par {course.par}</span>
        {seat !== null && <span className="text-[var(--text-muted)]">Strokes: <span className="font-semibold text-[var(--text-primary)] tabular-nums">{view.strokes[seat]}</span></span>}
      </div>

      <svg ref={svg} viewBox={layout.box.join(' ')} role="img"
        aria-label={`Mini golf, hole ${view.hole + 1}, par ${course.par}`}
        className="w-full select-none rounded-2xl golf-svg" style={{ maxWidth: `calc(70vh * ${layout.box[2] / layout.box[3]})`, touchAction: canShoot ? 'none' : 'auto' }}
        onPointerDown={down} onPointerMove={drag} onPointerUp={up}
        onPointerCancel={() => { press.current = null; setPull(null); }}>
        <defs>
          <radialGradient id={`${id}-lawn`} cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#3f8f4a" /><stop offset="100%" stopColor="#24603a" />
          </radialGradient>
          <pattern id={`${id}-mow`} width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="90" height="90" fill="#4fc25e" /><rect width="45" height="90" fill="#49b857" />
          </pattern>
          <pattern id={`${id}-sand`} width="26" height="26" patternUnits="userSpaceOnUse">
            <rect width="26" height="26" fill="#f0d79a" />
            <circle cx="5" cy="6" r="1.7" fill="#d6b46d" /><circle cx="17" cy="15" r="1.5" fill="#d6b46d" /><circle cx="10" cy="21" r="1.3" fill="#fff1c9" /><circle cx="21" cy="4" r="1.1" fill="#fff1c9" />
          </pattern>
          <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f2fbff" /><stop offset="55%" stopColor="#c4ebf8" /><stop offset="100%" stopColor="#e3f6fd" />
          </linearGradient>
          <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8fd8" /><stop offset="100%" stopColor="#1b5fae" />
          </linearGradient>
          {Object.entries(SLOPE_DIR).map(([k, deg]) => (
            // darker uphill, lighter downhill
            <linearGradient key={k} id={`${id}-slope-${k}`} gradientTransform={`rotate(${deg} .5 .5)`}>
              <stop offset="0%" stopColor="#3a9a49" /><stop offset="100%" stopColor="#6fd57c" />
            </linearGradient>
          ))}
          <linearGradient id={`${id}-rail`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2a868" /><stop offset="100%" stopColor="#a8682f" />
          </linearGradient>
          <radialGradient id={`${id}-ball`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" /><stop offset="60%" stopColor="#fff" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.28" />
          </radialGradient>
          <radialGradient id={`${id}-cup`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#000" /><stop offset="80%" stopColor="#0b130d" /><stop offset="100%" stopColor="#24432a" />
          </radialGradient>
        </defs>

        {/* the garden around the course */}
        <rect x={layout.box[0]} y={layout.box[1]} width={layout.box[2]} height={layout.box[3]} fill={`url(#${id}-lawn)`} />
        {layout.decor.map((d, i) => <Decor key={i} d={d} />)}

        {/* the course, raised a little above the lawn */}
        {layout.tiles.map(t => <rect key={`sh${t.c},${t.r}`} x={t.x + 10} y={t.y + 14} width={T} height={T} fill="#000" opacity="0.28" />)}
        {layout.tiles.map(t => <rect key={`g${t.c},${t.r}`} x={t.x - 0.5} y={t.y - 0.5} width={T + 1} height={T + 1} fill={`url(#${id}-mow)`} />)}
        {layout.tiles.map(t => <Patch key={`p${t.c},${t.r}`} t={t} id={id} />)}

        {/* the tee mat */}
        <rect x={course.tee[0] - 40} y={course.tee[1] - 26} width={80} height={52} rx={10} fill="#2b7a39" stroke="#9fe0aa" strokeOpacity="0.6" strokeWidth={3} />
        <circle cx={course.tee[0] - 28} cy={course.tee[1]} r={5} fill="#fff" opacity="0.85" />
        <circle cx={course.tee[0] + 28} cy={course.tee[1]} r={5} fill="#fff" opacity="0.85" />

        {/* rails along every edge, just outside it, and the baffles across the fairway */}
        <g strokeLinecap="round">
          {layout.rails.map(([x1, y1, x2, y2, nx, ny], i) => {
            const o = RAIL / 2;
            return <line key={`rs${i}`} x1={x1 + nx * o + 5} y1={y1 + ny * o + 8} x2={x2 + nx * o + 5} y2={y2 + ny * o + 8} stroke="#000" strokeOpacity="0.3" strokeWidth={RAIL} />;
          })}
          {layout.baffles.map(([x1, y1, x2, y2], i) => <line key={`bs${i}`} x1={x1 + 5} y1={y1 + 8} x2={x2 + 5} y2={y2 + 8} stroke="#000" strokeOpacity="0.3" strokeWidth={16} />)}
          {layout.rails.map(([x1, y1, x2, y2, nx, ny], i) => {
            const o = RAIL / 2;
            return <line key={`rb${i}`} x1={x1 + nx * o} y1={y1 + ny * o} x2={x2 + nx * o} y2={y2 + ny * o} stroke="#6b3d1a" strokeWidth={RAIL} />;
          })}
          {layout.baffles.map(([x1, y1, x2, y2], i) => <line key={`bb${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b3d1a" strokeWidth={16} />)}
          {layout.rails.map(([x1, y1, x2, y2, nx, ny], i) => {
            const o = RAIL / 2 - 2;
            return <line key={`rt${i}`} x1={x1 + nx * o} y1={y1 + ny * o} x2={x2 + nx * o} y2={y2 + ny * o} stroke={`url(#${id}-rail)`} strokeWidth={RAIL - 8} />;
          })}
          {layout.baffles.map(([x1, y1, x2, y2], i) => <line key={`bt${i}`} x1={x1} y1={y1 - 1} x2={x2} y2={y2 - 1} stroke="#d39a5c" strokeWidth={8} />)}
        </g>

        {course.bumpers.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x + 5} cy={y + 8} r={r} fill="#000" opacity="0.3" />
            <circle cx={x} cy={y} r={r} fill="#b91c1c" />
            <circle cx={x} cy={y} r={r * 0.8} fill="#ef4444" />
            <circle cx={x} cy={y} r={r * 0.46} fill="#fff" />
            <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.22} fill="#fff" opacity="0.55" />
          </g>
        ))}

        {/* the cup and its flag */}
        <circle cx={cx} cy={cy} r={CUP + 5} fill="#7ddc8a" opacity="0.55" />
        <circle cx={cx} cy={cy} r={CUP} fill={`url(#${id}-cup)`} />
        <g className="golf-flag" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - pole} stroke="#f8fafc" strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${cx} ${cy - pole} q 30 4 56 16 q -26 10 -56 18 Z`} fill="#ef4444" />
        </g>

        {canShoot && (
          <g pointerEvents="none">
            {/* the line of the putt: dots out ahead, longer with more power */}
            {Array.from({ length: Math.floor(aimLen / 34) }, (_, k) => (
              <circle key={k} cx={mineBall[0] + Math.cos(angle) * (BALL + 26 + k * 34)} cy={mineBall[1] + Math.sin(angle) * (BALL + 26 + k * 34)}
                r={7 - k * 0.35} fill="#fff" opacity={0.9 - k * 0.07} />
            ))}
            <g transform={`translate(${mineBall[0]} ${mineBall[1]}) rotate(${(angle * 180) / Math.PI})`}>
              <path d={`M ${aimLen + 34} 0 L ${aimLen + 8} -15 L ${aimLen + 8} 15 Z`} fill={aimColor} stroke="#0f172a" strokeOpacity="0.35" strokeWidth={3} />
              {pull && <line x1={-BALL - 4} y1={0} x2={-BALL - 4 - shownPower * 140} y2={0} stroke="#fff" strokeOpacity="0.5" strokeWidth={6} strokeLinecap="round" />}
            </g>
            {pull && (
              <g>
                <circle cx={mineBall[0]} cy={mineBall[1]} r={BALL + 18} fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth={8} />
                <circle cx={mineBall[0]} cy={mineBall[1]} r={BALL + 18} fill="none" stroke={aimColor} strokeWidth={8}
                  strokeDasharray={`${2 * Math.PI * (BALL + 18) * shownPower} 999`} transform={`rotate(-90 ${mineBall[0]} ${mineBall[1]})`} strokeLinecap="round" />
              </g>
            )}
          </g>
        )}
        {frame?.trail?.map(([x, y], k) => <circle key={`t${k}`} cx={x} cy={y} r={BALL * (0.35 + k * 0.07)} fill="#fff" opacity={0.08 + k * 0.05} />)}
        {/* the ball on turn is drawn last, on top of any sharing its spot */}
        {balls.map((b, i) => [b, i]).sort((a, b) => (a[1] === view.turn) - (b[1] === view.turn)).map(([b, i]) => (b ? (
          <g key={i}>
            <circle cx={b[0] + 4} cy={b[1] + 6} r={BALL} fill="#000" opacity="0.32" />
            <circle cx={b[0]} cy={b[1]} r={BALL} fill={BALL_COLORS[i % 4]} stroke="#0f172a" strokeOpacity="0.45" strokeWidth={2} />
            <circle cx={b[0]} cy={b[1]} r={BALL} fill={`url(#${id}-ball)`} />
            {view.turn === i && !view.over && !playing && <circle cx={b[0]} cy={b[1]} r={BALL + 10} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth={3} className="golf-ring" />}
          </g>
        ) : null))}
        {frame?.end?.water && <circle className="golf-splash" cx={frame.pos[0]} cy={frame.pos[1]} r={30} fill="none" stroke="#bfe3ff" strokeWidth={6} />}
        {frame?.end?.holed && <circle className="golf-splash" cx={cx} cy={cy} r={34} fill="none" stroke="#fde047" strokeWidth={6} />}
      </svg>

      {pull && <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">Power {Math.round(pull.power * 100)}%</p>}

      {canShoot && !pull && (
        <div className="flex flex-col gap-2 w-full max-w-sm">
          <p className="text-[11px] text-[var(--text-muted)] text-center">Drag back from anywhere and let go to putt. The further you pull, the harder. Tap the course to aim.</p>
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
      {!canShoot && !view.over && !playing && (
        view.turn !== seat && <p className="text-xs text-[var(--text-muted)]">{name(view.turn)} is lining up a putt.</p>
      )}

      {!playing && last.current?.frames && (
        <button type="button" onClick={() => play(last.current)} className="btn-ghost text-xs">
          <RotateCcw size={13} aria-hidden="true" /> Replay the last stroke
        </button>
      )}

      {/* The scorecard */}
      <div className="w-full max-w-md overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-xs text-[var(--text-secondary)] tabular-nums">
          <thead>
            <tr className="text-[var(--text-muted)] bg-[var(--bg-elevated)]">
              <th className="text-left font-semibold py-1.5 px-2">Player</th>
              {Array.from({ length: view.holes }, (_, h) => <th key={h} className={`font-semibold px-1 ${h === view.hole && !view.over ? 'text-[var(--accent)]' : ''}`}>{h + 1}</th>)}
              <th className="font-semibold px-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: view.n }, (_, i) => (
              <tr key={i} className={`border-t border-[var(--border)] ${view.out?.[i] ? 'opacity-40' : ''}`}>
                <td className="py-1.5 px-2 text-left">
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
                <td className="px-2 text-center font-semibold text-[var(--text-primary)]">{sum[i] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parTotal > 0 && <p className="text-[11px] text-[var(--text-muted)] px-2 py-1 border-t border-[var(--border)]">Lowest total after hole {view.holes} wins.</p>}
      </div>
    </div>
  );
}
