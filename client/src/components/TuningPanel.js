import { DIMENSIONS } from "../lib/dimensions";
import { DEFAULT_SENSITIVITY } from "../lib/heat";
import Icon from "./Icon";

const describe = (v) => (v === 0 ? "Off" : v < 0.75 ? "Relaxed" : v <= 1.25 ? "Default" : v < 1.75 ? "Strict" : "Very strict");

// Per-dimension sensitivity. Changing it recolors instantly: Jev's raw
// judgments are kept and only the weighting in code changes.
export default function TuningPanel({ sensitivity, onChange }) {
  const isDefault = DIMENSIONS.every((d) => sensitivity[d.id] === DEFAULT_SENSITIVITY[d.id]);
  return (
    <details className="tuning card">
      <summary>
        Tune sensitivity
        {!isDefault && <span className="tuned-dot" title="Customized" />}
        <Icon name="chevronDown" size={16} className="chev" />
      </summary>
      <p className="muted small">
        Some teams are fine with bluntness; others hear a jab in every “just checking”. Adjust what counts as hot for you. Changes apply
        instantly without re-checking.
      </p>
      <div className="tuning-grid">
        {DIMENSIONS.map((d) => (
          <label key={d.id} className="tuning-row">
            <span className="tuning-label">{d.label}</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.25"
              value={sensitivity[d.id]}
              onChange={(e) => onChange({ [d.id]: Number(e.target.value) })}
              aria-valuetext={describe(sensitivity[d.id])}
            />
            <span className="tuning-value">{describe(sensitivity[d.id])}</span>
          </label>
        ))}
      </div>
      {!isDefault && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(DEFAULT_SENSITIVITY)}>
          Reset to defaults
        </button>
      )}
    </details>
  );
}
