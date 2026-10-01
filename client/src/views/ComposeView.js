import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer from "../components/Composer";
import TuningPanel from "../components/TuningPanel";
import RadarChart from "../components/RadarChart";
import ReadinessGauge from "../components/ReadinessGauge";
import MessageSummary from "../components/MessageSummary";
import HeatText from "../components/HeatText";
import SentenceInspector from "../components/SentenceInspector";
import SendBar from "../components/SendBar";
import Icon from "../components/Icon";
import { useAnalysis } from "../hooks/useAnalysis";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import { load, save } from "../lib/storage";
import { copyText } from "../lib/clipboard";
import { AUDIENCES } from "../lib/dimensions";
import { EXAMPLES } from "../lib/examples";
import { counts as countTiers, placeholderRanges, radarValues, readiness, replaceSentence, scoreSentences } from "../lib/heat";

export default function ComposeView({ active, draftToOpen, onDraftOpened, onRequireAccount }) {
  const { settings, status: authStatus, updateSettings } = useAuth();
  const toast = useToast();
  const working = useMemo(() => load("working", null), []);

  const [text, setText] = useState(working?.text ?? "");
  const [audience, setAudience] = useState(working?.audience ?? settings.audience ?? "peer");
  const [channel, setChannel] = useState(working?.channel ?? settings.channel ?? "email");
  const [context, setContext] = useState(working?.context ?? "");
  const [draft, setDraft] = useState(working?.draft ?? null);
  const [lens, setLens] = useState("all");
  const [selectedText, setSelectedText] = useState(null);
  const [baselineResult, setBaselineResult] = useState(null);
  const [fixes, setFixes] = useState([]);
  const [seenPatterns, setSeenPatterns] = useState({});
  const [saving, setSaving] = useState(false);
  const [mobilePane, setMobilePane] = useState("write");
  const composerRef = useRef(null);
  const pendingFocus = useRef(null);

  const sensitivity = settings.sensitivity;
  const options = useMemo(() => ({ audience, channel, context }), [audience, channel, context]);
  const analysis = useAnalysis(text, options);
  const result = analysis.result;

  // Autosave the working message locally so a refresh never loses it.
  useEffect(() => {
    const t = setTimeout(() => save("working", text ? { text, audience, channel, context, draft } : null), 400);
    return () => clearTimeout(t);
  }, [text, audience, channel, context, draft]);

  // The first completed analysis of a message becomes its baseline.
  useEffect(() => {
    if (result && !baselineResult && result.message) setBaselineResult(result);
  }, [result, baselineResult]);

  const resetSession = useCallback(() => {
    setBaselineResult(null);
    setFixes([]);
    setSeenPatterns({});
    setSelectedText(null);
  }, []);

  const scoredAll = useMemo(() => scoreSentences(result?.sentences, sensitivity), [result, sensitivity]);
  const scoredLens = useMemo(() => (lens === "all" ? scoredAll : scoreSentences(result?.sentences, sensitivity, lens)), [lens, scoredAll, result, sensitivity]);
  const message = result?.message ?? null;
  const radar = useMemo(() => (result ? radarValues(scoredAll, message, sensitivity) : null), [result, scoredAll, message, sensitivity]);
  const score = useMemo(() => readiness(scoredAll, message), [scoredAll, message]);
  const tierCounts = useMemo(() => countTiers(scoredAll), [scoredAll]);

  const baselineScored = useMemo(() => (baselineResult ? scoreSentences(baselineResult.sentences, sensitivity) : null), [baselineResult, sensitivity]);
  const baselineRadar = useMemo(
    () => (baselineResult && baselineResult !== result ? radarValues(baselineScored, baselineResult.message, sensitivity) : null),
    [baselineResult, baselineScored, result, sensitivity]
  );
  const baselineScore = useMemo(() => (baselineResult && baselineResult !== result ? readiness(baselineScored, baselineResult.message) : null), [baselineResult, baselineScored, result]);

  const flagged = useMemo(() => scoredAll.filter((s) => s.tier === "hot" || s.tier === "warm"), [scoredAll]);
  const selected = useMemo(() => (selectedText ? scoredAll.find((s) => s.analysis && s.text === selectedText) || null : null), [scoredAll, selectedText]);

  const hottestByDim = useMemo(() => {
    const out = {};
    for (const s of scoredAll) {
      if (!s.analysis) continue;
      for (const d of Object.keys(s.dims)) if (!out[d] || s.dims[d] > out[d].dims[d]) out[d] = s;
    }
    for (const d of Object.keys(out)) if (out[d].dims[d] < 0.2) delete out[d];
    return out;
  }, [scoredAll]);

  const select = useCallback(
    (index) => {
      const s = scoredAll.find((x) => x.index === index);
      if (!s) return;
      setSelectedText((prev) => (prev === s.text ? null : s.text));
      setMobilePane("radar");
    },
    [scoredAll]
  );

  const flaggedPos = selected ? flagged.findIndex((s) => s.text === selected.text) : -1;
  const goFlagged = (delta) => {
    if (!flagged.length) return;
    const base = flaggedPos === -1 ? (delta > 0 ? -1 : 0) : flaggedPos;
    const next = flagged[(base + delta + flagged.length) % flagged.length];
    setSelectedText(next.text);
  };

  const fixNext = () => {
    const target = flagged.find((s) => s.tier === "hot") || flagged[0];
    if (target) {
      setSelectedText(target.text);
      setMobilePane("radar");
    }
  };

  const applyCandidate = (candidate) => {
    if (!selected) return;
    const replaced = replaceSentence(text, selected, candidate.text);
    if (!replaced) {
      toast("That sentence changed since it was checked. Edit it directly in the message.", { tone: "warn" });
      return;
    }
    setText(replaced.text);
    setFixes((f) => [...f, ...(candidate.edits?.length ? candidate.edits : [{ id: "custom", dim: selected.dominant, label: "Your own rewrite" }])]);
    setSelectedText(candidate.text);
    const holes = placeholderRanges(candidate.text);
    if (holes.length) {
      pendingFocus.current = { start: replaced.start + holes[0].start, end: replaced.start + holes[0].end };
      setMobilePane("write");
      const list = new Intl.ListFormat("en", { type: "conjunction" }).format(holes.map((h) => h.text));
      toast(`Fill in ${list} to finish the fix.`, { tone: "info", duration: 4500 });
    } else {
      toast("Rewrite applied.", { tone: "good" });
    }
  };

  useEffect(() => {
    if (pendingFocus.current) {
      const { start, end } = pendingFocus.current;
      pendingFocus.current = null;
      requestAnimationFrame(() => composerRef.current?.focusRange(start, end));
    }
  }, [text]);

  const setOptions = (patch) => {
    if (patch.audience) {
      setAudience(patch.audience);
      updateSettings({ audience: patch.audience });
    }
    if (patch.channel) {
      setChannel(patch.channel);
      updateSettings({ channel: patch.channel });
    }
    if (patch.context !== undefined) setContext(patch.context);
  };

  const loadMessage = useCallback(
    (m, nextDraft = null) => {
      setText(m.text);
      if (m.audience) setAudience(m.audience);
      if (m.channel) setChannel(m.channel);
      setContext(m.context || "");
      setDraft(nextDraft);
      resetSession();
      setMobilePane("radar");
    },
    [resetSession]
  );

  useEffect(() => {
    if (draftToOpen) {
      loadMessage(draftToOpen, { id: draftToOpen.id, title: draftToOpen.title });
      onDraftOpened();
    }
  }, [draftToOpen, loadMessage, onDraftOpened]);

  const clear = () => {
    setText("");
    setContext("");
    setDraft(null);
    resetSession();
  };

  const saveDraft = useCallback(async () => {
    if (!text.trim()) return;
    if (authStatus !== "signedIn") {
      onRequireAccount("Sign in to save drafts and pick up where you left off on any device.");
      return;
    }
    setSaving(true);
    const body = { text, audience, channel, context, readiness: score, radar: radar ? { pa: radar.pa, blame: radar.blame, hedge: radar.hedge, ask: radar.ask } : null };
    try {
      const res = draft?.id ? await api(`/drafts/${draft.id}`, { method: "PUT", body }) : await api("/drafts", { method: "POST", body });
      setDraft({ id: res.draft.id, title: res.draft.title });
      toast("Draft saved.", { tone: "good" });
    } catch (err) {
      if (err.status === 404) setDraft(null);
      toast(err.message, { tone: "warn" });
    } finally {
      setSaving(false);
    }
  }, [text, audience, channel, context, score, radar, draft, authStatus, onRequireAccount, toast]);

  const send = async () => {
    if (await copyText(text)) {
      toast(tierCounts.hot ? "Copied. Fingers crossed." : "Copied. Paste it into your message and hit send.", { tone: tierCounts.hot ? "warn" : "good" });
    } else {
      toast("Couldn't access the clipboard. Select the text and copy it manually.", { tone: "warn" });
    }
    if (authStatus === "signedIn" && radar && score !== null) {
      const fixedIds = new Set(fixes.map((f) => f.id));
      const patterns = [
        ...fixes.map((f) => ({ id: f.id, dim: f.dim, label: f.label, fixed: true })),
        ...Object.values(seenPatterns).filter((p) => !fixedIds.has(p.id)).map((p) => ({ ...p, fixed: false })),
      ];
      api("/checks", {
        method: "POST",
        body: {
          audience,
          channel,
          sentenceCount: tierCounts.analyzed,
          hot: tierCounts.hot,
          warm: tierCounts.warm,
          readiness: score,
          baselineReadiness: baselineScore ?? score,
          radar: { pa: radar.pa, blame: radar.blame, hedge: radar.hedge, ask: radar.ask },
          baselineRadar: baselineRadar ? { pa: baselineRadar.pa, blame: baselineRadar.blame, hedge: baselineRadar.hedge, ask: baselineRadar.ask } : null,
          tone: message?.tone ?? null,
          fixesApplied: fixes.length,
          patterns,
        },
      }).catch(() => {});
    }
  };

  // Keyboard shortcuts while this view is visible.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.target.closest?.(".inspector")) {
        e.preventDefault();
        analysis.refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, saveDraft, analysis]);

  const audienceLabel = AUDIENCES.find((a) => a.id === audience)?.label ?? "this reader";
  const hasText = Boolean(text.trim());

  return (
    <div className={`compose pane-${mobilePane}`}>
      <div className="mobile-switch seg" role="tablist" aria-label="View">
        <button role="tab" aria-selected={mobilePane === "write"} className={mobilePane === "write" ? "on" : ""} onClick={() => setMobilePane("write")}>
          <Icon name="pen" size={15} /> Write
        </button>
        <button role="tab" aria-selected={mobilePane === "radar"} className={mobilePane === "radar" ? "on" : ""} onClick={() => setMobilePane("radar")}>
          <Icon name="radar" size={15} /> Radar
          {tierCounts.hot > 0 && <span className="count-badge">{tierCounts.hot}</span>}
        </button>
      </div>

      <div className="compose-left">
        <Composer
          ref={composerRef}
          text={text}
          onTextChange={(t) => {
            setText(t);
            if (!t.trim()) resetSession();
          }}
          audience={audience}
          channel={channel}
          context={context}
          onOptionsChange={setOptions}
          status={analysis.status}
          stats={result ? { roundTripMs: result.roundTripMs, cached: result.stats?.cached ?? 0 } : null}
          onLoadExample={(ex) => loadMessage(ex)}
          onSave={saveDraft}
          onClear={clear}
          saving={saving}
          draftTitle={draft?.title}
        />
        <TuningPanel sensitivity={sensitivity} onChange={(patch) => updateSettings({ sensitivity: patch })} />
      </div>

      <div className="compose-right">
        {!hasText ? (
          <EmptyRadar onPick={(ex) => loadMessage(ex)} />
        ) : (
          <>
            <section className="card radar-card" aria-label="Message overview">
              <div className="radar-grid">
                <RadarChart
                  values={radar}
                  baseline={baselineRadar}
                  scanning={analysis.status === "scanning"}
                  hottest={hottestByDim}
                  onAxisClick={(dim) => hottestByDim[dim] && setSelectedText(hottestByDim[dim].text)}
                />
                <div className="radar-side">
                  <ReadinessGauge score={score} baseline={baselineScore} scanning={analysis.status === "scanning"} />
                  <MessageSummary message={message} audienceLabel={audienceLabel} />
                </div>
              </div>
            </section>

            {analysis.error && (
              <div className="error-box" role="alert">
                {analysis.error}{" "}
                <button className="link" onClick={analysis.refresh}>
                  Try again
                </button>
              </div>
            )}

            <section className="card heat-card" aria-label="Sentence heatmap">
              {result ? (
                <HeatText
                  text={result.text}
                  sentences={scoredLens}
                  selectedIndex={selected?.index}
                  onSelect={select}
                  lens={lens}
                  onLensChange={setLens}
                  stale={analysis.stale}
                />
              ) : (
                <div className="scanning-placeholder">
                  <span className="mini-radar" aria-hidden="true" /> Scanning your message…
                </div>
              )}
            </section>

            {selected && (
              <SentenceInspector
                sentence={selected}
                options={options}
                sensitivity={sensitivity}
                onApply={applyCandidate}
                onClose={() => setSelectedText(null)}
                onPrev={flagged.length > 1 || (flagged.length === 1 && flaggedPos === -1) ? () => goFlagged(-1) : null}
                onNext={flagged.length > 1 || (flagged.length === 1 && flaggedPos === -1) ? () => goFlagged(1) : null}
                position={flaggedPos >= 0 ? `Flagged ${flaggedPos + 1} of ${flagged.length}` : `Sentence ${selected.index + 1}`}
                onPatterns={(patterns) =>
                  setSeenPatterns((prev) => {
                    const next = { ...prev };
                    for (const p of patterns) next[p.id] = { id: p.id, dim: p.dim, label: p.label };
                    return next;
                  })
                }
              />
            )}

            <SendBar counts={tierCounts} onFixNext={fixNext} onSend={send} disabled={!hasText} stale={analysis.stale || analysis.status === "scanning"} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyRadar({ onPick }) {
  return (
    <section className="card empty-radar">
      <RadarChart values={null} scanning />
      <h2>Check your tone before you hit send</h2>
      <p className="muted">
        Every sentence gets a heat score for <strong>passive-aggression</strong>, <strong>blame</strong>, <strong>hedging</strong>, and{" "}
        <strong>unclear asks</strong>. Click a red sentence to see why it's hot and get rewrites that Jev has checked to keep your meaning.
      </p>
      <div className="example-buttons">
        {EXAMPLES.slice(0, 3).map((ex) => (
          <button key={ex.id} className="btn" onClick={() => onPick(ex)}>
            <Icon name="sparkle" size={14} /> {ex.name}
          </button>
        ))}
      </div>
    </section>
  );
}
