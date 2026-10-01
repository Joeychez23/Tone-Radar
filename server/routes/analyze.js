const express = require("express");
const { analyzeMessage } = require("../lib/analyze");
const { suggestRewrites } = require("../lib/rewrite");
const { AUDIENCES, CHANNELS } = require("../lib/audience");
const { optionalAuth } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

// Cancels the Jev call when the browser aborts (e.g. the user kept typing).
function abortOnClose(req, res) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

const pickOptions = (body) => ({
  audience: AUDIENCES[body.audience] ? body.audience : "peer",
  channel: CHANNELS[body.channel] ? body.channel : "email",
  context: typeof body.context === "string" ? body.context : "",
});

router.get("/options", (req, res) => {
  res.json({ audiences: AUDIENCES, channels: CHANNELS });
});

router.post("/analyze", optionalAuth, rateLimit({ name: "analyze", windowMs: 60_000, max: 90 }), async (req, res) => {
  const body = req.body || {};
  const result = await analyzeMessage(String(body.text ?? ""), pickOptions(body), { signal: abortOnClose(req, res) });
  res.json(result);
});

router.post("/suggest", optionalAuth, rateLimit({ name: "suggest", windowMs: 60_000, max: 60 }), async (req, res) => {
  const body = req.body || {};
  const opts = pickOptions(body);
  const result = await suggestRewrites(
    {
      sentence: body.sentence,
      audience: opts.audience,
      channel: opts.channel,
      custom: body.custom,
    },
    { signal: abortOnClose(req, res) }
  );
  res.json(result);
});

module.exports = router;
