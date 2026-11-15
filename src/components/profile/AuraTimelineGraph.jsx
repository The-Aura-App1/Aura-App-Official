import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Lock, RotateCcw } from 'lucide-react';
import { api } from '../../api';

// A profile's aura balance over time, like a stock chart. The server keeps a
// running total of balance changes per day and per month
// (GET /aura/history/{userId}); the line is worked out backwards from
// today's balance, so its right end is always the balance on the profile.

export const TIME_RANGES = [
  { label: '1W',  value: '1w'  },
  { label: '1M',  value: '1m'  },
  { label: '3M',  value: '3m'  },
  { label: '1Y',  value: '1y'  },
  { label: 'All', value: 'all' },
];

const W = 600, H = 220;
const PAD = { top: 18, right: 52, bottom: 14, left: 10 };
const GW = W - PAD.left - PAD.right;
const GH = H - PAD.top - PAD.bottom;

const whole = n => Math.round(n).toLocaleString();
const signed = n => (n > 0 ? `+${whole(n)}` : n < 0 ? `−${whole(-n)}` : '0');

// Turns the server's per-period changes into balances: one point at the start
// of the range, then the balance at the end of each day (or month).
export function buildSeries(balance, points, unit) {
  const values = new Array(points.length);
  let running = balance;
  for (let i = points.length - 1; i >= 0; i--) {
    values[i] = running;
    running -= points[i].net;
  }
  const end = date => (unit === 'month'
    ? Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 1) - 1   // the month's last moment
    : Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 23, 59, 59));
  const startTime = points.length
    ? (unit === 'month' ? Date.UTC(+points[0].date.slice(0, 4), +points[0].date.slice(5, 7) - 1, 1) : end(points[0].date) - 86400000)
    : Date.now();
  return [
    { t: startTime, value: running, net: 0, start: true },
    ...points.map((p, i) => ({ t: Math.min(end(p.date), Date.now()), value: values[i], net: p.net, date: p.date })),
  ];
}

// A smooth line that never overshoots between points (monotone cubic)
function smoothPath(pts) {
  if (pts.length < 2) return '';
  const n = pts.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C ${(pts[i].x + h).toFixed(1)} ${(pts[i].y + m[i] * h).toFixed(1)}, ${(pts[i + 1].x - h).toFixed(1)} ${(pts[i + 1].y - m[i + 1] * h).toFixed(1)}, ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return path;
}

function dateLabel(t, unit, long = false) {
  const d = new Date(t);
  if (unit === 'month') return d.toLocaleDateString([], { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString([], long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function AuraTimelineGraph({ userId, balance: profileBalance = 0 }) {
  const gradId = `aura-graph-${useId().replace(/:/g, '')}`;
  const [range, setRange] = useState('1m');
  const [state, setState] = useState({ status: 'loading' });
  const [hover, setHover] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const svgRef = useRef(null);

  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, status: s.data ? 'refreshing' : 'loading' }));
    setHover(null);
    api.getAuraHistory(userId, range)
      .then(data => { if (live) setState({ status: 'ready', data }); })
      .catch(err => {
        if (!live) return;
        if (err.status === 403) setState({ status: 'private' });
        else setState({ status: 'error', message: err.message });
      });
    return () => { live = false; };
  }, [userId, range, attempt]);

  const data = state.data;
  const series = useMemo(
    () => (data ? buildSeries(data.balance ?? profileBalance, data.points ?? [], data.unit) : []),
    [data, profileBalance],
  );

  const values = series.map(p => p.value);
  // Zoomed to the data like a stock chart; a flat line sits in the middle
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const pad = hi > lo ? (hi - lo) * 0.15 : Math.max(Math.abs(hi) * 0.1, 10);
  const yMin = Math.max(lo - pad, Math.min(lo, 0));
  const yMax = hi + pad;
  const t0 = series[0]?.t ?? 0;
  const t1 = series[series.length - 1]?.t ?? 1;
  const x = t => PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * GW;
  const y = v => PAD.top + GH - ((v - yMin) / (yMax - yMin)) * GH;
  const pts = series.map(p => ({ x: x(p.t), y: y(p.value) }));
  const line = smoothPath(pts);
  const area = line ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${PAD.top + GH} L ${pts[0].x.toFixed(1)} ${PAD.top + GH} Z` : '';

  const first = series[0]?.value ?? 0;
  const latest = series[series.length - 1]?.value ?? profileBalance;
  const change = latest - first;
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const color = trend === 'down' ? '#f87171' : trend === 'up' ? 'var(--accent)' : 'var(--text-muted)';
  const quiet = series.length > 0 && series.every(p => !p.net);
  const shown = hover !== null ? series[hover] : null;

  function pick(e) {
    const svg = svgRef.current;
    if (!svg || series.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - px) < Math.abs(pts[best].x - px)) best = i; });
    setHover(best);
  }

  const gridValues = hi > lo ? [hi, (hi + lo) / 2, lo] : [hi];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {shown ? (shown.start ? 'Start of period' : dateLabel(shown.t, data?.unit, true)) : 'Aura balance'}
          </p>
          <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-tight">
            {whole(shown ? shown.value : latest)}
          </p>
          {shown && !shown.start ? (
            <p className={`text-sm font-medium ${shown.net > 0 ? 'text-[var(--accent)]' : shown.net < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
              {shown.net ? `${signed(shown.net)} that ${data?.unit === 'month' ? 'month' : 'day'}` : `No change that ${data?.unit === 'month' ? 'month' : 'day'}`}
            </p>
          ) : state.status === 'ready' || state.status === 'refreshing' ? (
            <p className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-[var(--accent)]' : trend === 'down' ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
              {trend === 'flat' ? <Minus size={14} /> : trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {trend === 'flat' ? 'No change' : signed(change)}
              {first > 0 && trend !== 'flat' && <span className="tabular-nums">({change > 0 ? '+' : ''}{((change / first) * 100).toFixed(1)}%)</span>}
              <span className="text-[var(--text-muted)] font-normal">this period</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-elevated)] rounded-xl p-1 border border-[var(--border)]" role="group" aria-label="Time range">
          {TIME_RANGES.map(r => (
            <button key={r.value} type="button" onClick={() => setRange(r.value)} aria-pressed={range === r.value}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                ${range === r.value ? 'bg-aura-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden relative">
        {state.status === 'loading' && <div className="h-[220px] animate-pulse bg-[var(--bg-elevated)]" aria-label="Loading the aura timeline" />}

        {state.status === 'private' && (
          <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-center px-6">
            <Lock size={20} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--text-muted)]">This account is private. Follow it to see its aura over time.</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-[var(--text-muted)]">Couldn't load the aura timeline.</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]">
              <RotateCcw size={13} aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {(state.status === 'ready' || state.status === 'refreshing') && series.length > 1 && (
          <>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`w-full block touch-pan-y select-none transition-opacity ${state.status === 'refreshing' ? 'opacity-60' : ''}`}
              style={{ height: 220 }} role="img"
              aria-label={`Aura balance from ${whole(first)} to ${whole(latest)} over the period`}
              onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {gridValues.map((v, i) => (
                <g key={i}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
                  <text x={W - PAD.right + 8} y={y(v) + 4} fontSize="11" fill="var(--text-muted)" className="tabular-nums">
                    {Math.abs(v) >= 10000 ? `${(v / 1000).toFixed(0)}K` : whole(v)}
                  </text>
                </g>
              ))}

              <path d={area} fill={`url(#${gradId})`} key={`a${range}${data?.balance}`} className="aura-graph-fade" />
              <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" key={`l${range}${data?.balance}`} className="aura-graph-draw" />

              {/* days where something happened, as small ticks on the line */}
              {series.length <= 95 && series.map((p, i) => (p.net ? (
                <circle key={i} cx={pts[i].x} cy={pts[i].y} r="2.2" fill={p.net > 0 ? color : '#f87171'} opacity="0.7" />
              ) : null))}

              {hover !== null && (
                <>
                  <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.top} y2={PAD.top + GH} stroke="var(--text-muted)" strokeOpacity="0.5" strokeDasharray="3 3" />
                  <circle cx={pts[hover].x} cy={pts[hover].y} r="9" fill={color} opacity="0.18" />
                  <circle cx={pts[hover].x} cy={pts[hover].y} r="4.5" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
                </>
              )}
              {hover === null && (
                <>
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="9" fill={color} className="aura-graph-ping" />
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={color} />
                </>
              )}
            </svg>
            <div className="flex justify-between text-[11px] text-[var(--text-muted)] px-3 pb-2.5" style={{ paddingRight: `${(PAD.right / W) * 100}%` }}>
              <span>{dateLabel(series[0].t, data?.unit)}</span>
              <span>{dateLabel(series[Math.floor(series.length / 2)].t, data?.unit)}</span>
              <span>{data?.unit === 'month' ? dateLabel(series[series.length - 1].t, data?.unit) : 'Today'}</span>
            </div>
          </>
        )}
      </div>

      {(state.status === 'ready' || state.status === 'refreshing') && (
        quiet ? (
          <p className="text-center text-xs text-[var(--text-muted)]">No aura changes in this period.</p>
        ) : series.length > 1 && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['High', whole(Math.max(...values))],
              ['Low', whole(Math.min(...values))],
              ['Best day', (() => { const best = Math.max(...series.map(p => p.net)); return best > 0 ? signed(best) : '–'; })()],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{k === 'Best day' && data?.unit === 'month' ? 'Best month' : k}</dt>
                <dd className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        )
      )}
    </div>
  );
}
