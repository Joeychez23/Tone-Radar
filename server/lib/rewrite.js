// Builds rewrite candidates for one sentence from the lexicon, then asks Jev
// to judge every candidate (tone, meaning kept, natural wording) in a single
// request. Ranking happens on the client so tuning sliders apply instantly.
const { ENTRIES, TIME_EXPRESSION, REQUEST_SHAPE, cap } = require("./lexicon");
const { candidateQuestions, readSentence } = require("./questions");
const { describeAudience, describeChannel } = require("./audience");
const { LruCache, hashKey } = require("./cache");
const jev = require("./jev");

const MAX_CANDIDATES = 14;
const MAX_SENTENCE_CHARS = 600;
const cache = new LruCache({ max: 3000 });

function findHits(sentence) {
  const hits = [];
  for (const entry of ENTRIES) {
    const flags = entry.pattern.flags.includes("g") ? entry.pattern.flags : entry.pattern.flags + "g";
    const re = new RegExp(entry.pattern.source, flags);
    let m;
    while ((m = re.exec(sentence))) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (entry.filter && !entry.filter(m)) continue;
      hits.push({ entry, match: m, start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  return hits.sort((a, b) => a.start - b.start || b.end - a.end);
}

// Greedy non-overlapping subset, preferring earlier and longer matches.
function nonOverlapping(hits) {
  const out = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start >= lastEnd) {
      out.push(h);
      lastEnd = h.end;
    }
  }
  return out;
}

function replacementFor(hit, alt = 0) {
  const r = hit.entry.replace[Math.min(alt, hit.entry.replace.length - 1)];
  if (typeof r === "function") return r(hit.match);
  return r.replace(/\$(\d)/g, (_, i) => hit.match[Number(i)] ?? "");
}

function applyEdits(sentence, edits) {
  let out = sentence;
  const sorted = [...edits].sort((a, b) => b.hit.start - a.hit.start);
  for (const { hit, to } of sorted) out = out.slice(0, hit.start) + to + out.slice(hit.end);
  return tidy(out, sentence);
}

// Repairs spacing, punctuation, and capitalization after phrases are removed.
function tidy(text, original) {
  let s = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\s*([,.;:!?])/g, "$2")
    .replace(/^[\s,;:—–-]+/, "")
    .replace(/[\s,;:—–-]+$/, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+(?:and|but|or|so)([.!?]*)$/i, "$1")
    .trim();
  if (!s) return "";
  if (!/^(?:but|and|so)\b/i.test(original.trim())) s = s.replace(/^(?:but|and|so),?\s+/i, "");
  if (/^[a-z]/.test(s) && !/^[a-z]+:\/\//.test(s)) s = cap(s);
  const originalEnd = (original.trim().match(/[.!?]+$/) || [""])[0];
  if (!/[.!?]$/.test(s) && originalEnd) s += originalEnd.slice(-1);
  if (/^(?:\[name\], )?(?:could|can|would|will|do|did|are|is) you\b/i.test(s)) s = s.replace(/[.!]$/, "?");
  return s;
}

function addDeadline(sentence) {
  if (TIME_EXPRESSION.test(sentence) || sentence.includes("[day]") || !REQUEST_SHAPE.test(sentence.trim())) return null;
  const m = sentence.match(/^(.*?)([.!?]*)$/s);
  return `${m[1]} by [day]${m[2] || "?"}`;
}

function describeEdit(hit, to) {
  return { id: hit.entry.id, dim: hit.entry.dim, label: hit.entry.label, from: hit.text.trim(), to: to.trim(), start: hit.start, end: hit.end };
}

function generateCandidates(sentence) {
  const hits = findHits(sentence);
  const seen = new Set([norm(sentence)]);
  const out = [];
  const add = (text, edits, kind) => {
    if (!text || text.split(/\s+/).length < 2) return;
    const key = norm(text);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, kind, edits });
  };
  const build = (pairs, kind) => {
    const edits = pairs.map(([hit, alt]) => ({ hit, to: replacementFor(hit, alt) }));
    add(applyEdits(sentence, edits), edits.map((e) => describeEdit(e.hit, e.to)), kind);
  };

  const combined = nonOverlapping(hits);
  if (combined.length > 1) build(combined.map((h) => [h, 0]), "all");

  const dims = [...new Set(combined.map((h) => h.entry.dim))];
  if (dims.length > 1) for (const dim of dims) build(combined.filter((h) => h.entry.dim === dim).map((h) => [h, 0]), `dim:${dim}`);

  for (const h of hits) {
    for (let alt = 0; alt < Math.min(h.entry.replace.length, 2); alt++) build([[h, alt]], "single");
  }

  if (combined.length >= 3 && combined.length <= 6) {
    combined.forEach((skip) => build(combined.filter((h) => h !== skip).map((h) => [h, 0]), "leave-one-out"));
  }

  // Asks without a deadline get a fill-in-the-blank version.
  for (const base of hits.length ? [out[0]?.text] : [sentence]) {
    if (!base) continue;
    const withDeadline = addDeadline(base);
    if (withDeadline) {
      const baseEdits = base === sentence ? [] : out[0].edits;
      add(withDeadline, [...baseEdits, { id: "ask.deadline", dim: "ask", label: "No deadline", from: "", to: "by [day]", start: sentence.length, end: sentence.length }], "deadline");
    }
  }

  return { hits, candidates: out.slice(0, MAX_CANDIDATES) };
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9[\]]+/g, " ").trim();

async function suggestRewrites({ sentence, audience = "peer", channel = "email", custom } = {}, { signal, jevClient = jev } = {}) {
  if (typeof sentence !== "string" || !sentence.trim()) {
    const err = new Error("A sentence is required.");
    err.status = 400;
    throw err;
  }
  const original = sentence.trim().slice(0, MAX_SENTENCE_CHARS);
  let candidates;
  let hits = [];
  if (typeof custom === "string" && custom.trim()) {
    candidates = [{ text: custom.trim().slice(0, MAX_SENTENCE_CHARS), kind: "custom", edits: [] }];
  } else {
    ({ hits, candidates } = generateCandidates(original));
  }

  const patterns = hits.map((h) => ({ id: h.entry.id, dim: h.entry.dim, label: h.entry.label, text: h.text.trim(), start: h.start, end: h.end }));
  const key = hashKey("r1", original, audience, channel, candidates.map((c) => c.text).join("\n"));
  const cached = cache.get(key);
  if (cached) return { ...cached, patterns, cached: true };

  const started = Date.now();
  // candidates[0] is the original, judged under the same conditions as the
  // rewrites so their scores are directly comparable. The surrounding message
  // is left out on purpose: each rewrite is judged as a sentence, and the
  // extra context made the meaning check penalize removing pointed asides.
  const texts = [original, ...candidates.map((c) => c.text)];
  const state = {
    channel: describeChannel(channel),
    audience: describeAudience(audience),
    original,
    candidates: texts,
  };
  const questions = {};
  texts.forEach((_, k) => Object.assign(questions, candidateQuestions(k)));
  const data = await jevClient.ask(state, questions, { signal });

  const read = (k) => ({
    ...readSentence(data.answers, `c${k}:`),
    meaning: round(data.answers[`c${k}:meaning`]?.noul ?? 0),
    natural: round(data.answers[`c${k}:natural`]?.noul ?? 0),
  });
  const result = {
    original: { text: original, ...read(0) },
    candidates: candidates.map((c, i) => ({ ...c, ...read(i + 1) })),
    stats: {
      latencyMs: Date.now() - started,
      candidates: candidates.length,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
  cache.set(key, result);
  return { ...result, patterns, cached: false };
}

const round = (n) => Math.round(n * 1000) / 1000;

module.exports = { suggestRewrites, generateCandidates, findHits, tidy, addDeadline };
