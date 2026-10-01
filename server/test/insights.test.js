const test = require("node:test");
const assert = require("node:assert/strict");
const { summarize } = require("../routes/insights");

test("summarizes checks into totals, trends, and top patterns", () => {
  const now = Date.now();
  const mk = (daysAgo, readiness, baselineReadiness, patterns = []) => ({
    createdAt: new Date(now - daysAgo * 86400000),
    audience: "peer",
    readiness,
    baselineReadiness,
    hot: readiness > 80 ? 0 : 1,
    sentenceCount: 4,
    fixesApplied: 2,
    radar: { pa: 0.2, blame: 0.1, hedge: 0.5, ask: 0.3 },
    baselineRadar: { pa: 0.6, blame: 0.1, hedge: 0.7, ask: 0.3 },
    patterns,
  });
  const checks = [
    mk(2, 70, 40, [{ id: "hedge.just", dim: "hedge", label: "Minimizer", fixed: true }]),
    mk(1, 85, 60, [{ id: "hedge.just", dim: "hedge", label: "Minimizer", fixed: false }]),
    mk(0, 90, 50, [{ id: "pa.perlast", dim: "pa", label: "Per my last email", fixed: true }]),
  ];
  const s = summarize(checks, 30);
  assert.equal(s.totals.messages, 3);
  assert.equal(s.totals.fixesApplied, 6);
  assert.equal(s.totals.sentClean, 2);
  assert.equal(s.totals.avgImprovement, 31.7);
  assert.equal(s.totals.streak, 3);
  assert.equal(s.patterns[0].id, "hedge.just");
  assert.equal(s.patterns[0].count, 2);
  assert.equal(s.daily.length, 3);
  assert.ok(s.weekly[0].hedgeBaseline >= s.weekly[0].hedge);
});
