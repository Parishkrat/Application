const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

const User = require("../models/user.js");
const Todo = require("../models/Todo.js");
const Person = require("../models/person.js");
const requireLogin = require("../middleware/auth.js");

dotenv.config();
const userApp = express.Router();

// Get user role from a todo
function getUserRole(todo, userName) {
  if (todo.owner === userName) return "owner";
  const shared = todo.sharedWith.find((entry) => entry.name === userName);
  return shared ? shared.role : null;
}

// Email transport setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ====================== ROUTES ====================== //

// HOME: View owned + shared todos
userApp.get("/", requireLogin, async (req, res) => {
  try {
    const userName = req.session.user.name;
    const todos = await Todo.find({
      $or: [{ owner: userName }, { "sharedWith.name": userName }],
    });

    const people = await Person.find({});
    res.render("todos", { todos, people, user: userName });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load todos");
  }
});

// =================== AUTH ROUTES =================== //

// Register Page (with invite token)
userApp.get("/register", async (req, res) => {
  const { token } = req.query;
  let invitedPerson = null;

  if (token) {
    invitedPerson = await Person.findOne({ inviteToken: token });
  }

  res.render("register", { invitedPerson });
});

// Register User
userApp.post("/users", async (req, res) => {
  try {
    const { name, password, token } = req.body;

    if (token) {
      const invitedPerson = await Person.findOne({ inviteToken: token });
      if (!invitedPerson) {
        return res.status(400).send("Invalid or expired invite link.");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, password: hashedPassword });
    await user.save();

    if (token) {
      await Person.updateOne(
        { inviteToken: token },
        { $unset: { inviteToken: "" } }
      );
    }

    res.redirect("/login");
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).send("Username already taken");
    } else {
      res.status(500).send("Registration failed");
    }
  }
});

// Login Page
userApp.get("/login", (req, res) => {
  res.render("login");
});

// Login User
userApp.post("/users/login", async (req, res) => {
  const user = await User.findOne({ name: req.body.name });
  if (!user) return res.status(400).send("User not found");

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.status(401).send("Incorrect password");

  req.session.user = { name: user.name };
  res.redirect("/");
});

// Logout
userApp.post("/users/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Logout failed");
    res.redirect("/login");
  });
});

// =================== TODO ACTIONS =================== //

// Create a new todo
userApp.post("/", requireLogin, async (req, res) => {
  try {
    const todo = new Todo({
      title: req.body.title,
      owner: req.session.user.name,
    });
    await todo.save();
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Failed to create todo");
  }
});

// Update (owner only)
userApp.post("/:id/update", requireLogin, async (req, res) => {
  try {
    await Todo.findOneAndUpdate(
      { _id: req.params.id, owner: req.session.user.name },
      { title: req.body.title }
    );
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Update failed");
  }
});

// Delete (owner only)
userApp.post("/:id/delete", requireLogin, async (req, res) => {
  try {
    await Todo.findOneAndDelete({
      _id: req.params.id,
      owner: req.session.user.name,
    });
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Delete failed");
  }
});

// =================== SHARING =================== //

// Share todo with a friend
userApp.post("/share", requireLogin, async (req, res) => {
  try {
    const { todoId, shareWithName, role } = req.body;
    const validRoles = ["editor", "viewer"];
    if (!validRoles.includes(role)) return res.status(400).send("Invalid role");

    const todo = await Todo.findById(todoId);
    if (!todo) return res.status(404).send("Todo not found");

    if (todo.owner !== req.session.user.name) {
      return res.status(403).send("Only the owner can share");
    }

    if (shareWithName === req.session.user.name) {
      return res.status(400).send("Cannot share with yourself");
    }

    const alreadyShared = todo.sharedWith.some((u) => u.name === shareWithName);
    if (alreadyShared) return res.status(400).send("User already shared with");

    todo.sharedWith.push({ name: shareWithName, role });
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Share error:", err);
    res.status(500).send("Share failed");
  }
});

// Revoke shared access
userApp.post("/unshare", requireLogin, async (req, res) => {
  try {
    const { todoId, name } = req.body;
    const todo = await Todo.findById(todoId);

    if (!todo || todo.owner !== req.session.user.name) {
      return res.status(403).send("Only owner can revoke access");
    }

    todo.sharedWith = todo.sharedWith.filter((entry) => entry.name !== name);
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Unshare error:", err);
    res.status(500).send("Unshare failed");
  }
});

// =================== EMAIL INVITE =================== //

// Send invite to email
userApp.post("/share-invite", requireLogin, async (req, res) => {
  try {
    const { name, email } = req.body;
    const inviteToken = crypto.randomBytes(20).toString("hex");

    const sharedPerson = new Person({ name, email, inviteToken });
    await sharedPerson.save();

    const inviteLink = `http://localhost:3000/register?token=${inviteToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "You have a new invite!",
      html: `
        <p>Hello <b>${name}</b>,</p>
        <p>You have been invited to TodoApp! 🎉</p>
        <p><a href="${inviteLink}">Click here to accept the invite</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.redirect("/");
  } catch (err) {
    console.error("Share invite error:", err);
    res.status(500).send("Failed to send invite");
  }
});

module.exports = userApp;
