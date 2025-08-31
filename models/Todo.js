// models/Todo.js
const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  owner: { type: String, required: true }, // Owner username or you could use ObjectId referencing User

  // Add sharedWith array for sharing info:
  sharedWith: [
    {
      name: { type: String, required: true }, // username of shared user
      role: { type: String, enum: ["viewer", "editor"], required: true },
    },
  ],
});

module.exports = mongoose.model("Todo", todoSchema);
