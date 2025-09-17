const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  isPaid: { type: Boolean, default: false },
  plan: { type: String, enum: ["free", "pro"], default: "free" },
});

module.exports = mongoose.model("User", userSchema);
