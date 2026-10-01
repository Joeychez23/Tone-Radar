const mongoose = require("mongoose");

// One record per message the user finalized ("Copy & send"). It stores
// scores and matched patterns only, never the message text.
const radarSchema = new mongoose.Schema(
  { pa: Number, blame: Number, hedge: Number, ask: Number },
  { _id: false }
);

const checkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    audience: { type: String, default: "peer" },
    channel: { type: String, default: "email" },
    sentenceCount: { type: Number, min: 0, default: 0 },
    hot: { type: Number, min: 0, default: 0 },
    warm: { type: Number, min: 0, default: 0 },
    readiness: { type: Number, min: 0, max: 100, required: true },
    baselineReadiness: { type: Number, min: 0, max: 100, default: null },
    radar: { type: radarSchema, required: true },
    baselineRadar: { type: radarSchema, default: null },
    tone: { type: String, default: null },
    fixesApplied: { type: Number, min: 0, default: 0 },
    patterns: [
      {
        _id: false,
        id: { type: String, maxlength: 60 },
        dim: { type: String, maxlength: 10 },
        label: { type: String, maxlength: 80 },
        fixed: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

checkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Check", checkSchema);
