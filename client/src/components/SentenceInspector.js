import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { DIMENSIONS, DIM_BY_ID, CLARITY_LEVELS } from "../lib/dimensions";
import { rankCandidates, sentenceHeat, tierOf, TIER_LABEL } from "../lib/heat";
import { diffWords } from "../lib/diff";
import { pct } from "../lib/format";
import Icon, { TierIcon } from "./Icon";

const argmax = (xs = []) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

// Detail panel for one sentence: why it's hot, which phrases cause it, and
// rewrites that Jev has checked for tone, meaning, and natural wording.
export default function SentenceInspector({ sentence, options, sensitivity, onApply, onClose, onPrev, onNext, position, onPatterns }) {
  const [state, setState] = useState({ status: "idle" });
  const [custom, setCustom] = useState("");
  const [customState, setCustomState] = useState({ status: "idle" });
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef(null);

  const sentenceText = sentence?.text;
  useEffect(() => {
    if (!sentenceText) return;
    setCustom(sentenceText);
    setCustomState({ status: "idle" });
    setShowAll(false);
    const ctrl = new AbortController();
    setState({ status: "loading" });
    api("/suggest", { method: "POST", body: { sentence: sentenceText, audience: options.audience, channel: options.channel }, signal: ctrl.signal })
      .then((data) => {
        setState({ status: "ready", data });
        if (data.patterns?.length) onPatterns?.(data.patterns);
      })
      .catch((err) => err.name !== "AbortError" && setState({ status: "error", error: err.message }));
    return () => ctrl.abort();
    // onPatterns is a fresh callback each render; refetching for it would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceText, options.audience, options.channel]);

  // Bring the panel into view and move focus to it when a sentence is picked.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const rect = el.getBoundingClientRect();
    if (rect.top >= 70 && rect.top <= window.innerHeight - 160) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const startY = window.scrollY;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Some embedded or background browsers ignore smooth scrolling; jump instead.
    const t = setTimeout(() => {
      if (window.scrollY === startY) el.scrollIntoView({ behavior: "auto", block: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, [sentenceText]);

  const ranked = useMemo(() => (state.data ? rankCandidates(state.data, sensitivity) : null), [state.data, sensitivity]);

  if (!sentence) return null;
  const { heat, dominant, dims } = sentenceHeat(sentence.analysis, sensitivity);
  const tier = tierOf(heat);

  const checkCustom = async () => {
    const text = custom.trim();
    if (!text || text === sentence.text) return;
    setCustomState({ status: "loading" });
    try {
      const data = await api("/suggest", { method: "POST", body: { sentence: sentence.text, custom: text, audience: options.audience, channel: options.channel } });
      const c = data.candidates[0];
      const after = sentenceHeat(c, sensitivity).heat;
      const before = sentenceHeat(data.original, sensitivity).heat;
      setCustomState({ status: "ready", candidate: { ...c, heat: after, tier: tierOf(after) }, before });
    } catch (err) {
      setCustomState({ status: "error", error: err.message });
    }
  };

  return (
    <section
      className={`inspector inspector-${tier}`}
      ref={panelRef}
      tabIndex={-1}
      aria-label={`Sentence ${sentence.index + 1} details`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="inspector-head">
        <span className={`tier-badge badge-${tier}`}>
          <TierIcon tier={tier} /> {TIER_LABEL[tier]} · {pct(heat)}
        </span>
        <span className="inspector-pos muted">{position}</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={onPrev} disabled={!onPrev} aria-label="Previous flagged sentence" title="Previous flagged sentence">
          <Icon name="arrowLeft" />
        </button>
        <button className="icon-btn" onClick={onNext} disabled={!onNext} aria-label="Next flagged sentence" title="Next flagged sentence">
          <Icon name="arrowRight" />
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Close sentence details" title="Close (Esc)">
          <Icon name="x" />
        </button>
      </header>

      <blockquote className="inspector-quote">
        <Highlighted text={sentence.text} culprits={ranked?.culprits || []} patterns={state.data?.patterns || []} />
      </blockquote>

      <div className="dim-grid">
        {DIMENSIONS.map((d) => (
          <DimRow key={d.id} dim={d} analysis={sentence.analysis} value={dims[d.id]} off={sensitivity[d.id] === 0} dominant={d.id === dominant && tier !== "cool"} />
        ))}
      </div>

      {tier !== "cool" && (
        <p className="inspector-tip">
          <Icon name="info" size={15} /> {DIM_BY_ID[dominant].tip}
        </p>
      )}

      <div className="suggest">
        <div className="suggest-head">
          <h3>
            <Icon name="wand" size={16} /> Suggested rewrites
          </h3>
          {state.status === "ready" && state.data.candidates.length > 0 && (
            <span className="muted small">
              Jev checked {state.data.candidates.length} rewrite{state.data.candidates.length === 1 ? "" : "s"}
              {state.data.cached ? " (cached)" : ` in ${state.data.stats.latencyMs} ms`}
            </span>
          )}
        </div>

        {state.status === "loading" && (
          <div className="suggest-loading" aria-live="polite">
            <span className="mini-radar" aria-hidden="true" /> Building and checking rewrites…
          </div>
        )}
        {state.status === "error" && <div className="error-box">{state.error}</div>}

        {state.status === "ready" && ranked && (
          <>
            {ranked.best.length === 0 ? (
              <p className="muted">
                {state.data.candidates.length === 0
                  ? tier === "cool"
                    ? "This sentence reads well. Nothing to fix."
                    : "No known patterns to rewrite here. Try your own version below."
                  : "None of the automatic rewrites kept your meaning and sounded better. Try your own version below."}
              </p>
            ) : (
              <ol className="suggest-list">
                {ranked.best.map((c, i) => (
                  <Suggestion key={c.text} c={c} original={sentence.text} beforeHeat={ranked.originalHeat} best={i === 0} onApply={() => onApply(c)} />
                ))}
              </ol>
            )}

            {ranked.all.length > 0 && (
              <details className="all-candidates" open={showAll} onToggle={(e) => setShowAll(e.currentTarget.open)}>
                <summary>
                  <Icon name="table" size={14} /> All {ranked.all.length} candidates Jev scored
                </summary>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rewrite</th>
                        <th className="num">Heat</th>
                        <th className="num">Keeps meaning</th>
                        <th className="num">Natural</th>
                        <th>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.all.map((c) => (
                        <tr key={c.text}>
                          <td>{c.text}</td>
                          <td className="num">{pct(c.heat)}</td>
                          <td className="num">{pct(c.meaning)}</td>
                          <td className="num">{pct(c.natural)}</td>
                          <td>{verdict(c, ranked.originalHeat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </div>

      <div className="custom">
        <label htmlFor="custom-rewrite">
          <Icon name="pen" size={14} /> Try your own version
        </label>
        <textarea
          id="custom-rewrite"
          rows={2}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setCustomState({ status: "idle" });
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              checkCustom();
            }
          }}
        />
        <div className="custom-actions">
          <button className="btn" onClick={checkCustom} disabled={customState.status === "loading" || !custom.trim() || custom.trim() === sentence.text}>
            {customState.status === "loading" ? "Checking…" : "Check with Jev"}
          </button>
          {customState.status === "ready" && (
            <>
              <HeatChange before={customState.before} after={customState.candidate.heat} />
              <span className={`muted small ${customState.candidate.meaning < 0.5 ? "warn-text" : ""}`}>keeps meaning {pct(customState.candidate.meaning)}</span>
              <button className="btn btn-primary" onClick={() => onApply({ ...customState.candidate, edits: [] })}>
                Use this
              </button>
            </>
          )}
          {customState.status === "error" && <span className="error-text small">{customState.error}</span>}
        </div>
      </div>
    </section>
  );
}

function verdict(c, originalHeat) {
  if (c.eligible) return "Suggested";
  if (c.heat >= originalHeat - 0.04) return "Not cooler";
  if (c.meaning < 0.4) return "Changes meaning";
  return "Reads awkwardly";
}

function DimRow({ dim, analysis, value, off, dominant }) {
  const tier = tierOf(value);
  let level;
  let confidence;
  if (dim.id === "ask") {
    level = analysis.request < 0.5 ? "No ask in this sentence" : CLARITY_LEVELS[argmax(analysis.levels?.clarity)];
    confidence = analysis.confidence?.ask;
  } else {
    level = dim.levels[argmax(analysis.levels?.[dim.id])];
    confidence = analysis.confidence?.[dim.id];
  }
  return (
    <div className={`dim-row ${dominant ? "is-dominant" : ""} ${off ? "is-off" : ""}`}>
      <div className="dim-name">
        {dim.label}
        {off && <span className="muted small"> (off)</span>}
      </div>
      <div className={`meter meter-${tier}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={dim.label}>
        <span style={{ width: `${Math.max(2, value * 100)}%` }} />
      </div>
      <div className="dim-value">{pct(value)}</div>
      <div className="dim-level">
        {level}
        {confidence !== undefined && confidence < 0.5 && <span className="unsure" title={`Jev's confidence: ${pct(confidence)}`}>unsure</span>}
      </div>
    </div>
  );
}

function Suggestion({ c, original, beforeHeat, best, onApply }) {
  const parts = diffWords(original, c.text);
  return (
    <li className={`suggestion ${best ? "is-best" : ""}`}>
      <div className="suggestion-text">
        {parts.map((p, i) => (
          <Fragment key={i}>
            {p.space && " "}
            {p.type === "same" ? (
              <span>{p.text}</span>
            ) : p.type === "add" ? (
              <ins>
                <Placeholders text={p.text} />
              </ins>
            ) : (
              <del>{p.text}</del>
            )}
          </Fragment>
        ))}
      </div>
      <div className="suggestion-meta">
        <HeatChange before={beforeHeat} after={c.heat} />
        <span className={`small ${c.meaning < 0.6 ? "warn-text" : "muted"}`} title="Jev's judgment that the rewrite keeps the same facts and request">
          {c.meaning < 0.6 ? "may drop some detail" : "keeps meaning"} {pct(c.meaning)}
        </span>
        <span className="muted small" title="Jev's judgment that the rewrite reads naturally">
          natural {pct(c.natural)}
        </span>
        {c.edits.length > 0 && <span className="muted small">fixes: {[...new Set(c.edits.map((e) => e.label))].join(", ")}</span>}
        <span className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={onApply}>
          <Icon name="check" size={14} /> Apply
        </button>
      </div>
    </li>
  );
}

function Placeholders({ text }) {
  const bits = text.split(/(\[(?:name|day|what|topic)\])/g);
  return bits.map((b, i) => (/^\[(?:name|day|what|topic)\]$/.test(b) ? <mark key={i} className="placeholder">{b}</mark> : b));
}

export function HeatChange({ before, after }) {
  const tb = tierOf(before);
  const ta = tierOf(after);
  return (
    <span className="heat-change" aria-label={`Heat ${pct(before)} to ${pct(after)}`}>
      <span className={`chip chip-${tb}`}>
        <TierIcon tier={tb} size={12} /> {pct(before)}
      </span>
      <Icon name="arrowRight" size={12} />
      <span className={`chip chip-${ta}`}>
        <TierIcon tier={ta} size={12} /> {pct(after)}
      </span>
    </span>
  );
}

// Underlines the phrases Jev confirmed are driving the heat (culprits) and,
// more faintly, other known patterns in the sentence.
function Highlighted({ text, culprits, patterns }) {
  const marks = [];
  const culpritIds = new Set(culprits.map((c) => c.id));
  for (const p of patterns) {
    if (p.end <= p.start || p.start >= text.length) continue;
    marks.push({ start: p.start, end: Math.min(p.end, text.length), culprit: culpritIds.has(p.id), label: p.label, dim: p.dim, drop: culprits.find((c) => c.id === p.id)?.drop });
  }
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor) continue;
    if (m.start > cursor) out.push(<span key={`t${cursor}`}>{text.slice(cursor, m.start)}</span>);
    const title = m.culprit ? `${m.label}: removing it lowers heat by ${pct(m.drop)}` : m.label;
    out.push(
      <mark key={`m${m.start}`} className={m.culprit ? "culprit" : "pattern"} title={title}>
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  }
  if (cursor < text.length) out.push(<span key={`t${cursor}`}>{text.slice(cursor)}</span>);
  return out;
}
