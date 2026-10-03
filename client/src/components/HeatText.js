import { Fragment } from "react";
import { DIM_BY_ID, DIMENSIONS } from "../lib/dimensions";
import { TIER_LABEL } from "../lib/heat";
import { pct } from "../lib/format";
import { TierIcon } from "./Icon";

const LENSES = [{ id: "all", short: "Overall" }, ...DIMENSIONS];

// The message rendered as a heatmap: every analyzed sentence is tinted by its
// tier and can be selected to open the inspector.
export default function HeatText({ text, sentences, selectedIndex, onSelect, lens, onLensChange, stale }) {
  const parts = [];
  let cursor = 0;
  for (const s of sentences) {
    if (s.start > cursor) parts.push({ gap: text.slice(cursor, s.start), key: `g${cursor}` });
    parts.push({ sentence: s, key: `s${s.index}` });
    cursor = s.end;
  }
  if (cursor < text.length) parts.push({ gap: text.slice(cursor), key: `g${cursor}` });

  return (
    <div className="heat">
      <div className="heat-toolbar">
        <span className="strip-label">
          Heat map <span className="strip-count">{sentences.length} {sentences.length === 1 ? "sentence" : "sentences"}</span>
        </span>
        <div className="seg seg-sm" role="radiogroup" aria-label="Color sentences by">
          {LENSES.map((l) => (
            <button key={l.id} role="radio" aria-checked={lens === l.id} className={lens === l.id ? "on" : ""} onClick={() => onLensChange(l.id)}>
              {l.short}
            </button>
          ))}
        </div>
        <div className="heat-legend" aria-hidden="true">
          {["cool", "warm", "hot"].map((t) => (
            <span key={t} className={`legend-chip chip-${t}`}>
              <TierIcon tier={t} size={12} /> {TIER_LABEL[t]}
            </span>
          ))}
        </div>
      </div>
      <div className={`heat-text ${stale ? "is-stale" : ""}`}>
        {parts.map((p) =>
          p.gap !== undefined ? (
            <Fragment key={p.key}>{p.gap}</Fragment>
          ) : (
            <Sentence key={p.key} s={p.sentence} selected={p.sentence.index === selectedIndex} onSelect={onSelect} lens={lens} />
          )
        )}
      </div>
    </div>
  );
}

function Sentence({ s, selected, onSelect, lens }) {
  if (!s.analysis) {
    return <span className="hs hs-skip" title={s.kind === "sentence" ? undefined : `${s.kind}: not scored`}>{s.text}</span>;
  }
  const dim = DIM_BY_ID[s.dominant];
  const label = `${TIER_LABEL[s.tier]}: ${lens === "all" ? dim.label : DIM_BY_ID[lens].label} ${pct(s.heat)}`;
  return (
    <span
      className={`hs hs-${s.tier} ${selected ? "is-selected" : ""}`}
      style={{ "--heat": s.heat.toFixed(3) }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Sentence ${s.index + 1}. ${label}. ${s.text}`}
      title={label}
      onClick={() => onSelect(s.index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(s.index);
        }
      }}
    >
      {s.text}
    </span>
  );
}
