import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatAura } from '../../utils/format';

const TIME_RANGES = [
  { label: '1D',  value: '1d'  },
  { label: '1W',  value: '1w'  },
  { label: '1M',  value: '1m'  },
  { label: '1Y',  value: '1y'  },
  { label: 'All', value: 'all' },
];

const W = 600, H = 200, PAD = { top: 16, right: 16, bottom: 24, left: 16 };
const GRAPH_W = W - PAD.left - PAD.right;
const GRAPH_H = H - PAD.top  - PAD.bottom;

export default function AuraTimelineGraph({ userId }) {
  const [range, setRange]         = useState('1m');
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [hover, setHover]         = useState(null); // { x, y, point }
  const svgRef                    = useRef(null);

  useEffect(() => {
    loadData();
  }, [range, userId]);

  async function loadData() {
    setLoading(true);
    try {
      // TODO: replace with real API call when transaction history endpoint is built
      // const data = await api.getAuraTimeline(userId, range);
      // For now show flat zero line — accurate representation of current state
      const points = buildZeroLine(range);
      setData(points);
    } finally {
      setLoading(false);
    }
  }

  function buildZeroLine(range) {
    const now = Date.now();
    const durations = {
      '1d':  86400000,
      '1w':  604800000,
      '1m':  2592000000,
      '1y':  31536000000,
      'all': 31536000000,
    };
    const duration = durations[range];
    const count    = 30;
    return Array.from({ length: count }, (_, i) => ({
      timestamp: now - duration + (duration / (count - 1)) * i,
      netAura:   0,
    }));
  }

  // ─── Derived values ───────────────────────────────────────
  const values  = data.map(d => d.netAura);
  const minVal  = Math.min(...values, 0);
  const maxVal  = Math.max(...values, 0);
  const valRange = maxVal - minVal || 1;

  const latest  = data[data.length - 1]?.netAura ?? 0;
  const first   = data[0]?.netAura ?? 0;
  const change  = latest - first;
  const isFlat  = change === 0;
  const isUp    = change > 0;
  const lineColor = isFlat ? '#6b7280' : isUp ? '#7c3aed' : '#ef4444';

  // ─── Convert data point to SVG coordinates ────────────────
  function toSVG(i, val) {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * GRAPH_W;
    const y = PAD.top  + GRAPH_H - ((val - minVal) / valRange) * GRAPH_H;
    return { x, y };
  }

  const svgPoints = data.map((d, i) => toSVG(i, d.netAura));

  const linePath = svgPoints.length > 1
    ? `M ${svgPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  const areaPath = svgPoints.length > 1
    ? `${linePath} L ${svgPoints[svgPoints.length-1].x},${PAD.top + GRAPH_H} L ${PAD.left},${PAD.top + GRAPH_H} Z`
    : '';

  // Zero line Y position
  const zeroY = PAD.top + GRAPH_H - ((0 - minVal) / valRange) * GRAPH_H;

  // ─── Mouse interaction ────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || data.length === 0) return;

    const rect   = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    const relX   = mouseX - PAD.left;
    const ratio  = Math.max(0, Math.min(1, relX / GRAPH_W));
    const idx    = Math.round(ratio * (data.length - 1));
    const point  = data[idx];
    const svgPt  = svgPoints[idx];

    if (!point || !svgPt) return;

    setHover({ x: svgPt.x, y: svgPt.y, point, idx });
  }, [data, svgPoints]);

  const handleMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  // ─── Format timestamp for tooltip ────────────────────────
  function formatTooltipDate(ts, range) {
    const d = new Date(ts);
    if (range === '1d') return d.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    if (range === '1w') return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatAxisDate(ts, range) {
    const d = new Date(ts);
    if (range === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '1w') return d.toLocaleDateString([], { weekday: 'short' });
    if (range === '1m') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  }

  // ─── Render ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 rounded-full border-2 border-[var(--border)]
                      border-t-aura-500 animate-spin" />
    </div>
  );

  const displayPoint = hover?.point ?? data[data.length - 1];
  const displayValue = displayPoint?.netAura ?? 0;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatAura(displayValue)}
          </p>
          {hover ? (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatTooltipDate(displayPoint.timestamp, range)}
            </p>
          ) : (
            <div className={`flex items-center gap-1 text-sm font-medium mt-0.5
              ${isFlat ? 'text-[var(--text-muted)]' : isUp ? 'text-aura-400' : 'text-red-400'}`}>
              {isFlat
                ? <><Minus size={14} /> No change</>
                : isUp
                  ? <><TrendingUp size={14} /> +{formatAura(change)} this period</>
                  : <><TrendingDown size={14} /> {formatAura(change)} this period</>
              }
            </div>
          )}
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-[var(--bg-elevated)]
                        rounded-xl p-1 border border-[var(--border)]">
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold
                          transition-all duration-200
                ${range === r.value
                  ? 'bg-aura-500 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Graph ── */}
      <div className="card p-0 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair"
          style={{ height: 180 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="auraAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Zero / baseline reference line */}
          <line
            x1={PAD.left} y1={zeroY}
            x2={W - PAD.right} y2={zeroY}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#auraAreaGrad)" />
          )}

          {/* Main line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* ── Hover elements ── */}
          {hover && (
            <>
              {/* Vertical crosshair */}
              <line
                x1={hover.x} y1={PAD.top}
                x2={hover.x} y2={PAD.top + GRAPH_H}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Dot on line */}
              <circle
                cx={hover.x} cy={hover.y}
                r={5}
                fill={lineColor}
                stroke="var(--bg-card)"
                strokeWidth="2"
              />

              {/* Tooltip bubble */}
              {(() => {
                const tipW  = 120;
                const tipH  = 40;
                const tipX  = Math.min(
                  Math.max(hover.x - tipW / 2, PAD.left),
                  W - PAD.right - tipW
                );
                const tipY  = hover.y > PAD.top + GRAPH_H / 2
                  ? hover.y - tipH - 10
                  : hover.y + 10;

                return (
                  <g>
                    <rect
                      x={tipX} y={tipY}
                      width={tipW} height={tipH}
                      rx={8}
                      fill="var(--bg-elevated)"
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 15}
                      textAnchor="middle"
                      fill={lineColor}
                      fontSize="12"
                      fontWeight="700"
                      fontFamily="-apple-system, sans-serif"
                    >
                      {formatAura(hover.point.netAura)}
                    </text>
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 30}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="9"
                      fontFamily="-apple-system, sans-serif"
                    >
                      net aura
                    </text>
                  </g>
                );
              })()}
            </>
          )}

          {/* End dot (when not hovering) */}
          {!hover && svgPoints.length > 0 && (() => {
            const last = svgPoints[svgPoints.length - 1];
            return (
              <>
                <circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
                <circle cx={last.x} cy={last.y} r={8} fill={lineColor} opacity={0.2} />
              </>
            );
          })()}
        </svg>

        {/* X axis labels */}
        <div className="flex justify-between text-xs text-[var(--text-muted)] px-4 pb-3">
          <span>{data[0] ? formatAxisDate(data[0].timestamp, range) : ''}</span>
          <span>{data[data.length-1] ? formatAxisDate(data[data.length-1].timestamp, range) : ''}</span>
        </div>
      </div>

      {/* Empty state note */}
      {values.every(v => v === 0) && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          No aura activity yet. Start posting to build your timeline.
        </p>
      )}
    </div>
  );
}