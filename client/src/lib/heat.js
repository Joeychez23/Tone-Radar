// Turns Jev's raw per-sentence judgments into heat, tiers, a readiness score,
// and ranked rewrites. Everything here is pure and runs on every render, so
// the tuning sliders recolor instantly without another API call.
import { DIM_IDS } from "./dimensions";

export const DEFAULT_SENSITIVITY = { pa: 1, blame: 1, hedge: 1, ask: 1 };
export const TIER_THRESHOLDS = { warm: 0.38, hot: 0.6 };

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function tierOf(heat) {
  if (heat >= TIER_THRESHOLDS.hot) return "hot";
  if (heat >= TIER_THRESHOLDS.warm) return "warm";
  return "cool";
}

export const TIER_LABEL = { cool: "Cool", warm: "Warm", hot: "Hot" };

// Per-dimension heat after applying sensitivity (0 turns a dimension off).
export function dimHeat(analysis, sensitivity = DEFAULT_SENSITIVITY) {
  const out = {};
  for (const id of DIM_IDS) out[id] = clamp01((analysis?.[id] ?? 0) * (sensitivity[id] ?? 1));
  return out;
}

export function sentenceHeat(analysis, sensitivity, lens = "all") {
  const dims = dimHeat(analysis, sensitivity);
  if (lens !== "all") return { heat: dims[lens], dominant: lens, dims };
  let dominant = DIM_IDS[0];
  for (const id of DIM_IDS) if (dims[id] > dims[dominant]) dominant = id;
  return { heat: dims[dominant], dominant, dims };
}

// Adds heat, tier, and dominant dimension to analyzed sentences.
export function scoreSentences(sentences = [], sensitivity, lens = "all") {
  return sentences.map((s) => {
    if (!s.analysis) return { ...s, heat: 0, tier: "none" };
    const { heat, dominant, dims } = sentenceHeat(s.analysis, sensitivity, lens);
    return { ...s, heat, tier: tierOf(heat), dominant, dims };
  });
}

// Peak heat per dimension across the message, plus reader friction.
export function radarValues(scored = [], message, sensitivity) {
  const out = Object.fromEntries(DIM_IDS.map((id) => [id, 0]));
  for (const s of scored) {
    if (!s.analysis) continue;
    const dims = dimHeat(s.analysis, sensitivity);
    for (const id of DIM_IDS) out[id] = Math.max(out[id], dims[id]);
  }
  out.friction = message ? clamp01(message.reaction) : 0;
  return out;
}

// 0–100: how ready the message is to send.
export function readiness(scored = [], message) {
  const analyzed = scored.filter((s) => s.analysis);
  if (!analyzed.length) return null;
  let score = 100;
  for (const s of analyzed) {
    if (s.tier === "hot") score -= 16 + 10 * ((s.heat - TIER_THRESHOLDS.hot) / (1 - TIER_THRESHOLDS.hot));
    else if (s.tier === "warm") score -= 5;
  }
  if (message) {
    score -= 15 * Math.max(0, (message.reaction - 0.33) / 0.67);
    score -= 15 * (1 - message.fit);
    if (message.hasRequest > 0.5 && message.nextStepClear < 0.5) score -= 8;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function readinessLabel(score) {
  if (score === null || score === undefined) return { label: "Waiting for text", tier: "none" };
  if (score >= 85) return { label: "Ready to send", tier: "cool" };
  if (score >= 65) return { label: "Almost there", tier: "warm" };
  if (score >= 40) return { label: "Needs work", tier: "hot" };
  return { label: "Don't send yet", tier: "hot" };
}

export function counts(scored = []) {
  const c = { hot: 0, warm: 0, cool: 0, analyzed: 0 };
  for (const s of scored) {
    if (!s.analysis) continue;
    c.analyzed += 1;
    c[s.tier] += 1;
  }
  return c;
}

const PLACEHOLDER = /\[(?:name|day|what|topic)\]/g;

// Ranks rewrite candidates: they must sound better, keep the meaning, and
// read naturally. Returns the best few plus every candidate for transparency.
export function rankCandidates(result, sensitivity, { limit = 3 } = {}) {
  if (!result?.original) return { best: [], all: [], originalHeat: 0, culprits: [] };
  const originalHeat = sentenceHeat(result.original, sensitivity).heat;
  const all = result.candidates.map((c) => {
    const { heat, dominant } = sentenceHeat(c, sensitivity);
    const placeholders = (c.text.match(PLACEHOLDER) || []).length;
    const eligible = c.meaning >= 0.4 && c.natural >= 0.45 && heat < originalHeat - 0.04;
    const score = (originalHeat - heat) * (0.5 + 0.5 * c.meaning) * (0.6 + 0.4 * c.natural) - 0.02 * placeholders;
    return { ...c, heat, tier: tierOf(heat), dominant, placeholders, eligible, score };
  });
  const best = all.filter((c) => c.eligible).sort((a, b) => b.score - a.score).slice(0, limit);

  // A pattern is a culprit when removing it alone lowers the heat.
  const drops = new Map();
  for (const c of all) {
    if (c.kind !== "single" || c.edits.length !== 1) continue;
    const e = c.edits[0];
    const drop = originalHeat - c.heat;
    if (!drops.has(e.id) || drops.get(e.id).drop < drop) drops.set(e.id, { ...e, drop });
  }
  const culprits = [...drops.values()].filter((d) => d.drop >= 0.08).sort((a, b) => b.drop - a.drop);
  return { best, all: all.sort((a, b) => b.score - a.score), originalHeat, culprits };
}

export function placeholderRanges(text) {
  const out = [];
  let m;
  const re = new RegExp(PLACEHOLDER.source, "g");
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

// Replaces one analyzed sentence in the current text, even if the user has
// typed elsewhere since the analysis ran.
export function replaceSentence(text, sentence, replacement) {
  if (text.slice(sentence.start, sentence.end) === sentence.text) {
    return { text: text.slice(0, sentence.start) + replacement + text.slice(sentence.end), start: sentence.start };
  }
  const idx = text.indexOf(sentence.text);
  if (idx === -1) return null;
  return { text: text.slice(0, idx) + replacement + text.slice(idx + sentence.text.length), start: idx };
}
