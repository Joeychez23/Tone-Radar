import { TONES, REACTIONS } from "../lib/dimensions";
import { pct } from "../lib/format";
import Icon from "./Icon";

// Whole-message judgments: overall tone, likely reaction, fit, next step.
export default function MessageSummary({ message, audienceLabel }) {
  if (!message) return null;
  const tone = TONES[message.tone] || { label: message.tone, detail: "" };
  const toneP = message.toneProbabilities?.[message.tone];
  const reactionLevel = Math.min(3, Math.max(0, Math.round(message.reaction * 3)));
  const reactionTier = reactionLevel >= 3 ? "hot" : reactionLevel === 2 ? "warm" : "cool";
  const fitTier = message.fit >= 0.75 ? "cool" : message.fit >= 0.4 ? "warm" : "hot";
  const fitLabel = message.fit >= 0.75 ? "Fits" : message.fit >= 0.4 ? "Somewhat off for" : "Wrong tone for";
  const nextTier = message.hasRequest < 0.5 ? "none" : message.nextStepClear >= 0.6 ? "cool" : message.nextStepClear >= 0.35 ? "warm" : "hot";

  return (
    <dl className="summary">
      <div className="summary-item">
        <dt>Overall tone</dt>
        <dd title={tone.detail}>
          <span className={`tone-dot tone-${message.tone}`} aria-hidden="true" />
          {tone.label}
          {toneP !== undefined && <span className="muted">{pct(toneP)} likely</span>}
        </dd>
      </div>
      <div className="summary-item">
        <dt>Reader will likely feel</dt>
        <dd className={`tier-text-${reactionTier}`}>{REACTIONS[reactionLevel]}</dd>
      </div>
      <div className="summary-item">
        <dt>Audience fit</dt>
        <dd className={`tier-text-${fitTier}`}>
          {fitLabel} {audienceLabel.toLowerCase()}
        </dd>
      </div>
      <div className="summary-item">
        <dt>Next step</dt>
        <dd className={nextTier === "none" ? "" : `tier-text-${nextTier}`}>
          {nextTier === "none" ? (
            "No ask in this message"
          ) : nextTier === "cool" ? (
            <>
              <Icon name="check" size={14} /> Clear
            </>
          ) : (
            <>
              <Icon name="alert" size={14} /> {nextTier === "warm" ? "Somewhat unclear" : "Unclear"}
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}
