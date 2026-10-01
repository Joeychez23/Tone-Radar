import { useEffect, useRef, useState } from "react";
import { RADAR_AXES } from "./RadarChart";

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Line chart with a snapping crosshair and one tooltip listing every series.
// series: [{ key, label, className }]; data: [{ label, [key]: number|null }]
export function LineChart({ data, series, height = 220, yMax = 100, yTicks = [0, 25, 50, 75, 100], formatY = (v) => v, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const widestTick = Math.max(...yTicks.map((t) => String(formatY(t)).length));
  const m = { top: 12, right: 16, bottom: 26, left: 14 + widestTick * 7 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const n = data.length;
  const x = (i) => m.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.top + ih - (v / yMax) * ih;

  const pathFor = (key) => {
    let d = "";
    let pen = false;
    data.forEach((row, i) => {
      const v = row[key];
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = n <= 1 ? 0 : Math.round(((px - m.left) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const xTickIdx = n <= 1 ? [0] : n <= 4 ? data.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 0), width - 170) : 0;

  return (
    <div className="linechart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
          if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1));
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={n <= 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="tick">
            {data[i]?.label}
          </text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} className="crosshair" />}
        {series.map((s) => (
          <path key={s.key} d={pathFor(s.key)} className={`line ${s.className}`} />
        ))}
        {series.map((s) => {
          // End dot on the last value of each series, plus a dot at the hovered X.
          const idx = hover ?? [...data.keys()].reverse().find((i) => data[i][s.key] !== null && data[i][s.key] !== undefined);
          const v = idx !== undefined ? data[idx]?.[s.key] : null;
          if (v === null || v === undefined) return null;
          return <circle key={s.key} cx={x(idx)} cy={y(v)} r="4.5" className={`dot ${s.className}`} />;
        })}
        {n === 1 &&
          series.map((s) =>
            data[0][s.key] === null || data[0][s.key] === undefined ? null : <circle key={`single-${s.key}`} cx={x(0)} cy={y(data[0][s.key])} r="4.5" className={`dot ${s.className}`} />
          )}
      </svg>
      {hover !== null && data[hover] && (
        <div className="chart-tooltip" style={{ left: tipLeft, top: 4 }}>
          <div className="tt-title">{data[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="tt-row">
              <span className={`tt-key ${s.className}`} />
              <strong>{data[hover][s.key] === null || data[hover][s.key] === undefined ? "–" : formatY(data[hover][s.key])}</strong>
              <span className="tt-muted">{s.label}</span>
            </div>
          ))}
          {data[hover].note && <div className="tt-muted small">{data[hover].note}</div>}
        </div>
      )}
    </div>
  );
}

// Horizontal bars with the value at the tip. One series, so no legend.
export function BarList({ rows, max, format = (v) => v, detail }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key} className="barlist-row" title={detail ? detail(r) : undefined}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(r.value / top) * 100}%` }} />
            <span className="barlist-value">{format(r.value)}</span>
          </span>
          {r.sub && <span className="barlist-sub muted small">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

// Tiny static radar used on draft cards.
export function MiniRadar({ values, size = 56 }) {
  const c = size / 2;
  const r = size / 2 - 4;
  const axes = RADAR_AXES.filter((a) => a.id !== "friction");
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return `${(c + Math.cos(a) * r * v).toFixed(1)},${(c + Math.sin(a) * r * v).toFixed(1)}`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mini-radar-svg" aria-hidden="true">
      <polygon points={axes.map((_, i) => pt(i, 1)).join(" ")} className="grid-ring" />
      <polygon points={axes.map((_, i) => pt(i, 0.5)).join(" ")} className="grid-ring" />
      {values && <polygon points={axes.map((a, i) => pt(i, Math.max(0.05, values[a.id] ?? 0))).join(" ")} className="series-now" />}
    </svg>
  );
}
