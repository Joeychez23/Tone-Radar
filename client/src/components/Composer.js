import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { AUDIENCES, CHANNELS } from "../lib/dimensions";
import { EXAMPLES } from "../lib/examples";

const MAX_CHARS = 8000;

// The writing surface: who it's for, how it's sent, optional situation, and
// the message itself. Exposes focusRange() so applied rewrites can select a
// placeholder for the user to fill in.
const Composer = forwardRef(function Composer(
  { text, onTextChange, audience, channel, context, onOptionsChange, status, stats, onLoadExample, onSave, onClear, saving, draftTitle },
  ref
) {
  const area = useRef(null);
  const [showContext, setShowContext] = useState(Boolean(context));

  useImperativeHandle(ref, () => ({
    focusRange(start, end) {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    },
  }));

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section className="composer card" aria-label="Write your message">
      <div className="composer-controls">
        <div className="seg" role="radiogroup" aria-label="Channel">
          {CHANNELS.map((c) => (
            <button key={c.id} role="radio" aria-checked={channel === c.id} className={channel === c.id ? "on" : ""} onClick={() => onOptionsChange({ channel: c.id })}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="audience">
          <span className="muted small">To</span>
          <select value={audience} onChange={(e) => onOptionsChange({ audience: e.target.value })} aria-label="Who is this for?">
            {AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <button className={`btn btn-ghost btn-sm ${showContext ? "on" : ""}`} onClick={() => setShowContext((v) => !v)} aria-expanded={showContext}>
          Situation
        </button>
      </div>

      {showContext && (
        <div className="context-box">
          <textarea
            value={context}
            maxLength={500}
            rows={2}
            placeholder="Optional background Jev should know, e.g. “This is the third missed deadline this month.”"
            onChange={(e) => onOptionsChange({ context: e.target.value })}
            aria-label="Situation"
          />
        </div>
      )}

      {draftTitle && (
        <div className="draft-pill">
          Editing draft: <strong>{draftTitle}</strong>
        </div>
      )}

      <textarea
        ref={area}
        className="composer-text"
        value={text}
        maxLength={MAX_CHARS}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={"Write or paste your email or Slack message here.\n\nTone Radar checks every sentence for passive-aggression, blame, hedging, and unclear asks as you type."}
        spellCheck
        aria-label="Message"
      />

      <div className="composer-foot">
        <span className={`status-dot status-${status}`} aria-hidden="true" />
        <span className="muted small" aria-live="polite">
          {status === "scanning" && "Scanning…"}
          {status === "ready" && stats && (
            <>
              Up to date in {stats.roundTripMs} ms
              {stats.cached > 0 && `, ${stats.cached} unchanged sentence${stats.cached === 1 ? "" : "s"} reused`}
            </>
          )}
          {status === "idle" && "Waiting for text"}
          {status === "error" && "Couldn't analyze"}
        </span>
        <span className="muted small counter">
          <span>{words} words</span>
          <span>
            {text.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
          </span>
        </span>
        <span className="spacer" />
        <ExampleMenu onPick={onLoadExample} />
        <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={!text} title="Clear message">
          Clear
        </button>
        <button className="btn btn-sm" onClick={onSave} disabled={!text.trim() || saving} title="Save draft (⌘S)">
          {saving ? "Saving…" : "Save draft"}
        </button>
      </div>
    </section>
  );
});

function ExampleMenu({ onPick }) {
  return (
    <label className="example-menu">
      <span className="sr-only">Load an example</span>
      <select
        value=""
        onChange={(e) => {
          const ex = EXAMPLES.find((x) => x.id === e.target.value);
          if (ex) onPick(ex);
        }}
      >
        <option value="">Load a sample</option>
        {EXAMPLES.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default Composer;
