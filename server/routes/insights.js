const express = require("express");
const Check = require("../models/Check");
const { AUDIENCES, CHANNELS } = require("../lib/audience");
const { requireDb, requireAuth } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const DIMS = ["pa", "blame", "hedge", "ask"];
const DAY = 24 * 60 * 60 * 1000;

// Mounted at /api, so auth is attached per route rather than with router.use
// (which would also catch unrelated /api paths and hide their 404s).
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const radarOf = (r) => (r && typeof r === "object" ? Object.fromEntries(DIMS.map((d) => [d, clamp(r[d], 0, 1)])) : null);

// Logs a finalized message. Only scores and pattern ids are stored.
router.post("/checks", requireDb, requireAuth, rateLimit({ name: "checks", windowMs: 60_000, max: 30 }), async (req, res) => {
  const b = req.body || {};
  const radar = radarOf(b.radar);
  if (!radar || !Number.isFinite(b.readiness)) return res.status(400).json({ error: "readiness and radar are required." });
  const patterns = Array.isArray(b.patterns)
    ? b.patterns.slice(0, 40).map((p) => ({
        id: String(p.id || "").slice(0, 60),
        dim: DIMS.includes(p.dim) ? p.dim : "pa",
        label: String(p.label || "").slice(0, 80),
        fixed: Boolean(p.fixed),
      }))
    : [];
  const check = await Check.create({
    user: req.userId,
    audience: AUDIENCES[b.audience] ? b.audience : "peer",
    channel: CHANNELS[b.channel] ? b.channel : "email",
    sentenceCount: clamp(b.sentenceCount, 0, 500),
    hot: clamp(b.hot, 0, 500),
    warm: clamp(b.warm, 0, 500),
    readiness: clamp(b.readiness, 0, 100),
    baselineReadiness: Number.isFinite(b.baselineReadiness) ? clamp(b.baselineReadiness, 0, 100) : null,
    radar,
    baselineRadar: radarOf(b.baselineRadar),
    tone: typeof b.tone === "string" ? b.tone.slice(0, 20) : null,
    fixesApplied: clamp(b.fixesApplied, 0, 500),
    patterns,
  });
  res.status(201).json({ id: check._id.toString() });
});

router.get("/insights", requireDb, requireAuth, async (req, res) => {
  const days = Math.round(clamp(req.query.days ?? 90, 7, 365));
  const since = new Date(Date.now() - days * DAY);
  const checks = await Check.find({ user: req.userId, createdAt: { $gte: since } }).sort({ createdAt: 1 }).limit(5000).lean();
  res.json(summarize(checks, days));
});

function summarize(checks, days) {
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const r1 = (n) => (n === null ? null : Math.round(n * 10) / 10);
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

  const byDay = new Map();
  for (const c of checks) {
    const k = dayKey(c.createdAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }
  const daily = [...byDay.entries()].map(([date, cs]) => ({
    date,
    count: cs.length,
    readiness: r1(avg(cs.map((c) => c.readiness))),
    baselineReadiness: r1(avg(cs.filter((c) => c.baselineReadiness !== null).map((c) => c.baselineReadiness))),
  }));

  // Weekly averages per dimension of the final message's radar.
  const weekStart = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  const byWeek = new Map();
  for (const c of checks) {
    const k = weekStart(c.createdAt);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k).push(c);
  }
  const weekly = [...byWeek.entries()].map(([week, cs]) => {
    const row = { week, count: cs.length };
    for (const d of DIMS) {
      row[d] = r1(avg(cs.map((c) => (c.radar?.[d] ?? 0) * 100)));
      const base = cs.filter((c) => c.baselineRadar).map((c) => (c.baselineRadar[d] ?? 0) * 100);
      row[`${d}Baseline`] = r1(avg(base));
    }
    return row;
  });

  const patternCounts = new Map();
  for (const c of checks) {
    for (const p of c.patterns || []) {
      const e = patternCounts.get(p.id) || { id: p.id, dim: p.dim, label: p.label, count: 0, fixed: 0 };
      e.count += 1;
      if (p.fixed) e.fixed += 1;
      patternCounts.set(p.id, e);
    }
  }
  const patterns = [...patternCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const audienceMap = new Map();
  for (const c of checks) {
    const e = audienceMap.get(c.audience) || { audience: c.audience, count: 0, readiness: [] };
    e.count += 1;
    e.readiness.push(c.readiness);
    audienceMap.set(c.audience, e);
  }
  const audiences = [...audienceMap.values()]
    .map((e) => ({ audience: e.audience, count: e.count, readiness: r1(avg(e.readiness)) }))
    .sort((a, b) => b.count - a.count);

  const improvements = checks.filter((c) => c.baselineReadiness !== null).map((c) => c.readiness - c.baselineReadiness);

  // Consecutive days (ending today or yesterday) with at least one check.
  let streak = 0;
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - DAY);
  if (byDay.has(today) || byDay.has(yesterday)) {
    let cursor = byDay.has(today) ? Date.now() : Date.now() - DAY;
    while (byDay.has(dayKey(cursor))) {
      streak += 1;
      cursor -= DAY;
    }
  }

  return {
    days,
    totals: {
      messages: checks.length,
      sentences: checks.reduce((a, c) => a + (c.sentenceCount || 0), 0),
      fixesApplied: checks.reduce((a, c) => a + (c.fixesApplied || 0), 0),
      sentClean: checks.filter((c) => c.hot === 0).length,
      avgReadiness: r1(avg(checks.map((c) => c.readiness))),
      avgImprovement: r1(avg(improvements)),
      streak,
    },
    daily,
    weekly,
    patterns,
    audiences,
  };
}

module.exports = router;
module.exports.summarize = summarize;
