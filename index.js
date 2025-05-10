const express = require('express');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const User = require('./models/user');
const Todo = require('./models/Todo');

dotenv.config();

const app = express();
app.use(express.json());

// Set up session middleware
app.use(session({
  secret: 'your-session-secret', 
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } 
}));

const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send('You must log in first');
  }
  next();
}

// Register
app.post('/users', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({ name: req.body.name, password: hashedPassword });
    await user.save();
    res.status(201).send('User registered');
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).send('Username already taken');
    } else {
      res.status(500).send('Registration failed');
    }
  }
});

// Login
app.post('/users/login', async (req, res) => {
  const user = await User.findOne({ name: req.body.name });
  if (!user) return res.status(400).send('Cannot find user');

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.status(401).send('Incorrect password');

  req.session.user = { name: user.name }; // Store user info in session
  res.send('Logged in successfully');
});

// Logout (optional)
app.post('/users/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout failed');
    res.send('Logged out');
  });
});

// Create Todo (protected)
app.post('/todos', requireLogin, async (req, res) => {
  try {
    const todo = new Todo({
      title: req.body.title,
      owner: req.session.user.name
    });
    await todo.save();
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).send('Failed to create todo');
  }
});

// Get Todos (protected)
app.get('/todos', requireLogin, async (req, res) => {
  try {
    const userTodos = await Todo.find({ owner: req.session.user.name });
    res.json(userTodos);
  } catch (err) {
    res.status(500).send('Failed to fetch todos');
  }
});

// Connect to DB and start server
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log('DATABASE CONNECTION SUCCESSFUL');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch((err) => {
    console.log('DATABASE CONNECTION FAILED');
    console.error(err);
  });
