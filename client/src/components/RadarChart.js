import { useState } from "react";
import { TIER_THRESHOLDS, tierOf, TIER_LABEL } from "../lib/heat";
import { pct } from "../lib/format";

export const RADAR_AXES = [
  { id: "pa", label: ["Passive-", "aggression"] },
  { id: "blame", label: ["Blame"] },
  { id: "hedge", label: ["Hedging"] },
  { id: "ask", label: ["Unclear", "asks"] },
  { id: "friction", label: ["Reader", "friction"] },
];

const W = 360;
const H = 330;
const CX = W / 2;
const CY = H / 2 + 4;
const R = 112;

const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_AXES.length;
const point = (i, v) => [CX + Math.cos(angle(i)) * R * v, CY + Math.sin(angle(i)) * R * v];
const ring = (v) => RADAR_AXES.map((_, i) => point(i, v).join(",")).join(" ");
const poly = (values) => RADAR_AXES.map((a, i) => point(i, Math.max(0.02, values?.[a.id] ?? 0)).join(",")).join(" ");

// Five-axis radar of the message's peak heat per dimension. The faint second
// polygon is the first check of this message, so improvement is visible.
export default function RadarChart({ values, baseline, scanning, onAxisClick, hottest = {} }) {
  const [hover, setHover] = useState(null);
  const hasData = Boolean(values);
  const showBaseline = Boolean(baseline && hasData);

  const summary = hasData
    ? RADAR_AXES.map((a) => `${a.label.join("")}: ${pct(values[a.id])}`).join(", ")
    : "No analysis yet";

  return (
    <div className="radar">
      <svg viewBox={`0 0 ${W} ${H}`} className={`radar-svg ${scanning ? "is-scanning" : ""}`} role="img" aria-label={`Tone radar. ${summary}`}>
        <defs>
          <radialGradient id="sweep-fade" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${CX} ${CY}) scale(${R})`}>
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.02" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.22" />
          </radialGradient>
        </defs>

        {/* Heat zones: the warm and hot bands carry a faint status wash. */}
        <polygon points={ring(1)} className="zone zone-hot" />
        <polygon points={ring(TIER_THRESHOLDS.hot)} className="zone zone-warm" />
        <polygon points={ring(TIER_THRESHOLDS.warm)} className="zone zone-cool" />
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <polygon key={v} points={ring(v)} className="grid-ring" />
        ))}
        {RADAR_AXES.map((a, i) => {
          const [x, y] = point(i, 1);
          return <line key={a.id} x1={CX} y1={CY} x2={x} y2={y} className="grid-spoke" />;
        })}
        <text x={CX + 4} y={CY - R * TIER_THRESHOLDS.hot - 4} className="zone-label">hot</text>
        <text x={CX + 4} y={CY - R * TIER_THRESHOLDS.warm - 4} className="zone-label">warm</text>

        <g className="sweep" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M${CX},${CY} L${CX + R},${CY} A${R},${R} 0 0,0 ${CX + Math.cos(-0.9) * R},${CY + Math.sin(-0.9) * R} Z`} fill="url(#sweep-fade)" />
          <line x1={CX} y1={CY} x2={CX + R} y2={CY} className="sweep-edge" />
        </g>

        {showBaseline && <polygon points={poly(baseline)} className="series-baseline" />}
        {hasData && <polygon points={poly(values)} className="series-now" />}

        {RADAR_AXES.map((a, i) => {
          const v = hasData ? values[a.id] : 0;
          const [vx, vy] = point(i, Math.max(0.02, v));
          const [lx, ly] = point(i, 1.24);
          const anchor = Math.abs(lx - CX) < 8 ? "middle" : lx > CX ? "start" : "end";
          const clickable = Boolean(onAxisClick && a.id !== "friction" && hottest[a.id]);
          return (
            <g
              key={a.id}
              className={`axis ${hover === a.id ? "is-hover" : ""} ${clickable ? "is-clickable" : ""}`}
              tabIndex={hasData ? 0 : -1}
              role={clickable ? "button" : undefined}
              aria-label={`${a.label.join("")}: ${hasData ? pct(v) : "no data"}${clickable ? ". Select the hottest sentence." : ""}`}
              onMouseEnter={() => setHover(a.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(a.id)}
              onBlur={() => setHover(null)}
              onClick={() => clickable && onAxisClick(a.id)}
              onKeyDown={(e) => {
                if (clickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onAxisClick(a.id);
                }
              }}
            >
              <circle cx={vx} cy={vy} r="16" className="hit" />
              <circle cx={lx} cy={ly} r="26" className="hit" />
              {hasData && <circle cx={vx} cy={vy} r="4.5" className={`vertex tier-${tierOf(v)}`} />}
              <text x={lx} y={ly - (a.label.length - 1) * 7} textAnchor={anchor} className="axis-label">
                {a.label.map((line, j) => (
                  <tspan key={j} x={lx} dy={j ? 14 : 0}>
                    {line}
                  </tspan>
                ))}
                {hasData && (
                  <tspan x={lx} dy="15" className="axis-value">
                    {pct(v)}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && hasData && (
        <RadarTooltip axis={RADAR_AXES.find((a) => a.id === hover)} value={values[hover]} baseline={showBaseline ? baseline[hover] : null} hottest={hottest[hover]} />
      )}

      {showBaseline && (
        <div className="legend" aria-hidden="true">
          <span className="legend-item">
            <span className="key key-now" /> Now
          </span>
          <span className="legend-item">
            <span className="key key-baseline" /> First check
          </span>
        </div>
      )}

      <table className="sr-only">
        <caption>Peak heat per tone dimension</caption>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Now</th>
            {showBaseline && <th>First check</th>}
          </tr>
        </thead>
        <tbody>
          {RADAR_AXES.map((a) => (
            <tr key={a.id}>
              <td>{a.label.join("")}</td>
              <td>{hasData ? pct(values[a.id]) : "–"}</td>
              {showBaseline && <td>{pct(baseline[a.id])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RadarTooltip({ axis, value, baseline, hottest }) {
  const tier = tierOf(value);
  return (
    <div className="chart-tooltip radar-tooltip">
      <div className="tt-title">{axis.label.join("")}</div>
      <div className="tt-row">
        <span className="tt-key key-now" />
        <strong>{pct(value)}</strong>
        <span className="tt-muted">now · {TIER_LABEL[tier]}</span>
      </div>
      {baseline !== null && (
        <div className="tt-row">
          <span className="tt-key key-baseline" />
          <strong>{pct(baseline)}</strong>
          <span className="tt-muted">first check</span>
        </div>
      )}
      {hottest && <div className="tt-quote">“{hottest.text.length > 90 ? `${hottest.text.slice(0, 88)}…` : hottest.text}”</div>}
      {hottest && <div className="tt-hint">Click to inspect this sentence</div>}
    </div>
  );
}
