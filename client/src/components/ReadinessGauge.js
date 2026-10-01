import { readinessLabel } from "../lib/heat";
import { TierIcon } from "./Icon";

const R = 70;
const CIRC = Math.PI * R;

// Half-circle meter for the 0–100 readiness score. The fill carries the
// status tier; the label and icon carry it too, so color is never alone.
export default function ReadinessGauge({ score, baseline, scanning }) {
  const { label, tier } = readinessLabel(score);
  const fraction = score === null || score === undefined ? 0 : score / 100;
  const delta = score !== null && baseline !== null && baseline !== undefined ? score - baseline : null;

  return (
    <div className={`gauge gauge-${tier} ${scanning ? "is-scanning" : ""}`}>
      <svg viewBox="0 0 180 104" className="gauge-svg" aria-hidden="true">
        <path d={`M20,92 A${R},${R} 0 0,1 160,92`} className="gauge-track" />
        <path
          d={`M20,92 A${R},${R} 0 0,1 160,92`}
          className="gauge-fill"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC * (1 - fraction)}
        />
      </svg>
      <div className="gauge-readout" aria-live="polite">
        <div className="gauge-score">
          {score ?? "–"}
          {score !== null && score !== undefined && <span className="gauge-of">/100</span>}
        </div>
        <div className="gauge-label">
          {tier !== "none" && <TierIcon tier={tier} />} {label}
        </div>
        {delta !== null && delta !== 0 && (
          <div className={`gauge-delta ${delta > 0 ? "up" : "down"}`}>
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)} since first check
          </div>
        )}
      </div>
    </div>
  );
}
