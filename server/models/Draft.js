const mongoose = require("mongoose");

const radarSchema = new mongoose.Schema(
  { pa: Number, blame: Number, hedge: Number, ask: Number },
  { _id: false }
);

const draftSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, trim: true, maxlength: 120, default: "Untitled draft" },
    text: { type: String, maxlength: 8000, default: "" },
    audience: { type: String, default: "peer" },
    channel: { type: String, default: "email" },
    context: { type: String, maxlength: 500, default: "" },
    readiness: { type: Number, min: 0, max: 100, default: null },
    radar: { type: radarSchema, default: null },
  },
  { timestamps: true }
);

draftSchema.index({ user: 1, updatedAt: -1 });

draftSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    title: this.title,
    text: this.text,
    audience: this.audience,
    channel: this.channel,
    context: this.context,
    readiness: this.readiness,
    radar: this.radar,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Draft", draftSchema);
