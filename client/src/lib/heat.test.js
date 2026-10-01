import { scoreSentences, readiness, radarValues, rankCandidates, replaceSentence, tierOf, placeholderRanges, DEFAULT_SENSITIVITY } from "./heat";

const a = (pa = 0, blame = 0, hedge = 0, ask = 0) => ({ pa, blame, hedge, ask, request: 0, clarity: 1, levels: {}, confidence: {} });

test("tiers follow the warm and hot thresholds", () => {
  expect(tierOf(0.1)).toBe("cool");
  expect(tierOf(0.45)).toBe("warm");
  expect(tierOf(0.8)).toBe("hot");
});

test("sentence heat is the hottest dimension, scaled by sensitivity", () => {
  const [s] = scoreSentences([{ index: 0, text: "x", analysis: a(0.3, 0.5, 0.2, 0) }], DEFAULT_SENSITIVITY);
  expect(s.heat).toBe(0.5);
  expect(s.dominant).toBe("blame");
  const [off] = scoreSentences([{ index: 0, text: "x", analysis: a(0.3, 0.5, 0.2, 0) }], { ...DEFAULT_SENSITIVITY, blame: 0 });
  expect(off.dominant).toBe("pa");
});

test("lens colors by a single dimension", () => {
  const [s] = scoreSentences([{ index: 0, text: "x", analysis: a(0.9, 0, 0.1, 0) }], DEFAULT_SENSITIVITY, "hedge");
  expect(s.heat).toBe(0.1);
  expect(s.tier).toBe("cool");
});

test("readiness drops for hot sentences and an unclear next step", () => {
  const cool = scoreSentences([{ index: 0, text: "x", analysis: a(0.1) }], DEFAULT_SENSITIVITY);
  const hot = scoreSentences([{ index: 0, text: "x", analysis: a(0.9) }], DEFAULT_SENSITIVITY);
  const msg = { reaction: 0.2, fit: 1, hasRequest: 0, nextStepClear: 1 };
  expect(readiness(cool, msg)).toBe(100);
  expect(readiness(hot, msg)).toBeLessThan(80);
  expect(readiness(cool, { ...msg, hasRequest: 0.9, nextStepClear: 0.1 })).toBe(92);
  expect(readiness([], msg)).toBeNull();
});

test("radar takes the peak per dimension and adds reader friction", () => {
  const scored = scoreSentences([{ index: 0, text: "a", analysis: a(0.2, 0.7) }, { index: 1, text: "b", analysis: a(0.6, 0.1) }], DEFAULT_SENSITIVITY);
  expect(radarValues(scored, { reaction: 0.4 }, DEFAULT_SENSITIVITY)).toEqual({ pa: 0.6, blame: 0.7, hedge: 0, ask: 0, friction: 0.4 });
});

test("rankCandidates keeps only cooler rewrites that keep the meaning", () => {
  const result = {
    original: a(0.8),
    candidates: [
      { text: "good", kind: "single", edits: [{ id: "pa.x", label: "x" }], ...a(0.1), meaning: 0.9, natural: 0.9 },
      { text: "changes meaning", kind: "all", edits: [], ...a(0.05), meaning: 0.2, natural: 0.9 },
      { text: "not cooler", kind: "all", edits: [], ...a(0.79), meaning: 0.95, natural: 0.95 },
    ],
  };
  const r = rankCandidates(result, DEFAULT_SENSITIVITY);
  expect(r.best.map((c) => c.text)).toEqual(["good"]);
  expect(r.culprits[0].id).toBe("pa.x");
  expect(r.all).toHaveLength(3);
});

test("replaceSentence uses offsets, then falls back to searching", () => {
  const s = { text: "Bad one.", start: 7, end: 15 };
  expect(replaceSentence("Hello. Bad one. Bye.", s, "Better.")).toEqual({ text: "Hello. Better. Bye.", start: 7 });
  expect(replaceSentence("Hey there. Bad one.", s, "Better.")).toEqual({ text: "Hey there. Better.", start: 11 });
  expect(replaceSentence("Nothing here.", s, "Better.")).toBeNull();
});

test("placeholderRanges finds fill-in-the-blank tokens", () => {
  expect(placeholderRanges("[name], could you send it by [day]?").map((p) => p.text)).toEqual(["[name]", "[day]"]);
});
