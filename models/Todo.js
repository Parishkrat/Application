const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },

  // Use email as owner (primary identifier)
  owner: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  // Shared with array based on email
  sharedWith: [
    {
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      role: {
        type: String,
        enum: ["viewer", "editor"],
        required: true,
      },
    },
  ],
});

module.exports = mongoose.model("Todo", todoSchema);
