const mongoose = require("mongoose");

const sensitivitySchema = new mongoose.Schema(
  {
    pa: { type: Number, min: 0, max: 2, default: 1 },
    blame: { type: Number, min: 0, max: 2, default: 1 },
    hedge: { type: Number, min: 0, max: 2, default: 1 },
    ask: { type: Number, min: 0, max: 2, default: 1 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    passwordHash: { type: String, required: true, select: false },
    settings: {
      audience: { type: String, default: "peer" },
      channel: { type: String, default: "email" },
      sensitivity: { type: sensitivitySchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    settings: {
      audience: this.settings?.audience ?? "peer",
      channel: this.settings?.channel ?? "email",
      sensitivity: {
        pa: this.settings?.sensitivity?.pa ?? 1,
        blame: this.settings?.sensitivity?.blame ?? 1,
        hedge: this.settings?.sensitivity?.hedge ?? 1,
        ask: this.settings?.sensitivity?.ask ?? 1,
      },
    },
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
