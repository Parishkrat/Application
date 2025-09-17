const mongoose = require("mongoose");

const personSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  inviteToken: {
    type: String,
    unique: true,
    sparse: true,
  },
});

module.exports = mongoose.model("Person", personSchema);
