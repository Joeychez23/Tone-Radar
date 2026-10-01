const path = require("path");
const fs = require("fs");
const express = require("express");
const config = require("./config");
const db = require("./db");
const { JevError } = require("./lib/jev");

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  next();
});
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: db.dbStatus(), accounts: config.accountsEnabled && db.isConnected() });
});

app.use("/api", require("./routes/analyze"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/drafts", require("./routes/drafts"));
app.use("/api", require("./routes/insights"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// In production the server also hosts the built React app.
const buildDir = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir, { index: false, maxAge: "1h" }));
  app.get("/{*splat}", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
}

// Express 5 forwards rejected promises from async handlers here.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must be valid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  if (err instanceof JevError) {
    if (err.status === 499) return res.status(499).end();
    const status = err.status === 429 ? 429 : 502;
    console.warn(`Jev error ${err.status}: ${err.message}`);
    return res.status(status).json({ error: err.message });
  }
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side." });
});

async function start() {
  db.connect();
  app.listen(config.port, () => {
    console.log(`Tone Radar API listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) start();

module.exports = app;
