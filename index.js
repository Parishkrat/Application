const express = require('express');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const User = require('./models/user');
const Todo = require('./models/Todo');

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;



// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For EJS form data
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// ==== ROUTES ====

// Home - show todos
app.get('/', requireLogin, async (req, res) => {
  const todos = await Todo.find({ owner: req.session.user.name });
  res.render('todos', { todos, user: req.session.user.name });
});

// Register page
app.get('/register', (req, res) => {
  res.render('register');
});

// Register user
app.post('/users', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({ name: req.body.name, password: hashedPassword });
    await user.save();
    res.redirect('/login');
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).send('Username already taken');
    } else {
      res.status(500).send('Registration failed');
    }
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Login user
app.post('/users/login', async (req, res) => {
  const user = await User.findOne({ name: req.body.name });
  if (!user) return res.status(400).send('Cannot find user');

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.status(401).send('Incorrect password');

  req.session.user = { name: user.name };
  res.redirect('/');
});

// Logout
app.post('/users/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout failed');
    res.redirect('/login');
  });
});

// Create todo
app.post('/todos', requireLogin, async (req, res) => {
  try {
    const todo = new Todo({
      title: req.body.title,
      owner: req.session.user.name
    });
    await todo.save();
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to create todo');
  }
});

// Update todo
app.post('/todos/:id/update', requireLogin, async (req, res) => {
  try {
    await Todo.findOneAndUpdate(
      { _id: req.params.id, owner: req.session.user.name },
      { title: req.body.title }
    );
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Update failed');
  }
});

// Delete todo
app.post('/todos/:id/delete', requireLogin, async (req, res) => {
  try {
    await Todo.findOneAndDelete({ _id: req.params.id, owner: req.session.user.name });
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Delete failed');
  }
});

// DB connection
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log('DATABASE CONNECTION SUCCESSFUL');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch((err) => {
    console.log('DATABASE CONNECTION FAILED');
    console.error(err);
  });
