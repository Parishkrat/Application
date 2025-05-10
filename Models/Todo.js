// models/Todo.js
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  owner: { type: String, required: true } // Could also reference User by ObjectId
});

module.exports = mongoose.model('Todo', todoSchema);
