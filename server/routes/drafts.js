const express = require("express");
const mongoose = require("mongoose");
const Draft = require("../models/Draft");
const { AUDIENCES, CHANNELS } = require("../lib/audience");
const { requireDb, requireAuth } = require("../middleware/auth");

const router = express.Router();
const MAX_DRAFTS = 200;
const DIMS = ["pa", "blame", "hedge", "ask"];

router.use(requireDb, requireAuth);

function pickDraft(body = {}) {
  const out = {};
  if (typeof body.text === "string") out.text = body.text.slice(0, 8000);
  if (typeof body.title === "string") out.title = body.title.trim().slice(0, 120) || "Untitled draft";
  if (typeof body.context === "string") out.context = body.context.slice(0, 500);
  if (AUDIENCES[body.audience]) out.audience = body.audience;
  if (CHANNELS[body.channel]) out.channel = body.channel;
  if (body.readiness === null || Number.isFinite(body.readiness)) {
    out.readiness = body.readiness === null ? null : Math.round(Math.min(100, Math.max(0, body.readiness)));
  }
  if (body.radar && typeof body.radar === "object") {
    out.radar = Object.fromEntries(DIMS.map((d) => [d, clamp01(body.radar[d])]));
  }
  return out;
}

const clamp01 = (v) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 0);

function deriveTitle(text = "") {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l && !/^(hi|hey|hello|dear)\b/i.test(l)) || text.trim();
  if (!firstLine) return "Untitled draft";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
}

function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Draft.findOne({ _id: req.params.id, user: req.userId });
}

router.get("/", async (req, res) => {
  const drafts = await Draft.find({ user: req.userId }).sort({ updatedAt: -1 }).limit(MAX_DRAFTS);
  res.json({ drafts: drafts.map((d) => d.toPublic()) });
});

router.post("/", async (req, res) => {
  if ((await Draft.countDocuments({ user: req.userId })) >= MAX_DRAFTS) {
    return res.status(409).json({ error: `You can keep up to ${MAX_DRAFTS} drafts. Delete some to save more.` });
  }
  const data = pickDraft(req.body);
  if (!data.title) data.title = deriveTitle(data.text);
  const draft = await Draft.create({ ...data, user: req.userId });
  res.status(201).json({ draft: draft.toPublic() });
});

router.get("/:id", async (req, res) => {
  const draft = await findOwned(req);
  if (!draft) return res.status(404).json({ error: "Draft not found." });
  res.json({ draft: draft.toPublic() });
});

router.put("/:id", async (req, res) => {
  const draft = await findOwned(req);
  if (!draft) return res.status(404).json({ error: "Draft not found." });
  const data = pickDraft(req.body);
  if (data.text !== undefined && req.body.title === undefined && draft.title === deriveTitle(draft.text)) {
    data.title = deriveTitle(data.text);
  }
  Object.assign(draft, data);
  await draft.save();
  res.json({ draft: draft.toPublic() });
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Draft not found." });
  const result = await Draft.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) return res.status(404).json({ error: "Draft not found." });
  res.status(204).end();
});

module.exports = router;
