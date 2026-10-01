const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Draft = require("../models/Draft");
const Check = require("../models/Check");
const { AUDIENCES, CHANNELS } = require("../lib/audience");
const { signToken, requireDb, requireAuth } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A real hash so failed logins for unknown emails take as long as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("tone-radar-timing-guard", BCRYPT_ROUNDS);

const authLimiter = rateLimit({ name: "auth", windowMs: 15 * 60_000, max: 30 });

router.use(requireDb);

router.post("/register", authLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Use a password between 8 and 128 characters." });
  }
  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) {
    return res.status(409).json({ error: "An account with that email already exists. Try signing in." });
  }
  const user = await User.create({
    email: normalized,
    name: typeof name === "string" ? name.trim().slice(0, 80) : "",
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "That email and password don't match." });
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  res.json({ user: user.toPublic() });
});

router.patch("/settings", requireAuth, async (req, res) => {
  const body = req.body || {};
  const update = {};
  if (typeof body.name === "string") update.name = body.name.trim().slice(0, 80);
  if (AUDIENCES[body.audience]) update["settings.audience"] = body.audience;
  if (CHANNELS[body.channel]) update["settings.channel"] = body.channel;
  if (body.sensitivity && typeof body.sensitivity === "object") {
    for (const dim of ["pa", "blame", "hedge", "ask"]) {
      const v = Number(body.sensitivity[dim]);
      if (Number.isFinite(v)) update[`settings.sensitivity.${dim}`] = Math.min(2, Math.max(0, v));
    }
  }
  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { returnDocument: "after", runValidators: true });
  if (!user) return res.status(401).json({ error: "Your account no longer exists." });
  res.json({ user: user.toPublic() });
});

// Deletes the account and everything stored for it.
router.delete("/account", requireAuth, async (req, res) => {
  await Promise.all([Draft.deleteMany({ user: req.userId }), Check.deleteMany({ user: req.userId })]);
  await User.findByIdAndDelete(req.userId);
  res.status(204).end();
});

module.exports = router;
