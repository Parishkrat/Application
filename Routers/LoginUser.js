const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto"); // for generating tokens
const User = require("../models/user.js");
const Todo = require("../models/Todo.js");
const requireLogin = require("../middleware/auth.js");
const Person = require("../models/person.js");
const nodemailer = require("nodemailer");
const userApp = express.Router();
const dotenv = require("dotenv");

dotenv.config();

// Home - show todos
// userApp.get("/", requireLogin, async (req, res) => {
//   try {
//     const todos = await Todo.find({ owner: req.session.user.name });
//     const people = await Person.find({}); // fetch people from DB
//     res.render("todos", { todos, people, user: req.session.user.name });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Failed to load data");
//   }
// });

// Register page (with optional invite token)
userApp.get("/register", async (req, res) => {
  const { token } = req.query;
  let invitedPerson = null;

  if (token) {
    invitedPerson = await Person.findOne({ inviteToken: token });
  }

  res.render("register", { invitedPerson });
});

// Register user
userApp.post("/users", async (req, res) => {
  try {
    const { name, password, token } = req.body;

    // If registering with invite token, validate it
    if (token) {
      const invitedPerson = await Person.findOne({ inviteToken: token });
      if (!invitedPerson) {
        return res.status(400).send("Invalid or expired invite link.");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, password: hashedPassword });
    await user.save();

    // If invite token was used, clear it (so it can't be reused)
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

// Login page
userApp.get("/login", (req, res) => {
  res.render("login");
});

// Login user
userApp.post("/users/login", async (req, res) => {
  const user = await User.findOne({ name: req.body.name });
  if (!user) return res.status(400).send("Cannot find user");

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

// mail.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your email address
    pass: process.env.EMAIL_PASS, // your email password or app-specific password
  },
});

userApp.post("/share-invite", requireLogin, async (req, res) => {
  try {
    const { name, email } = req.body;

    // Generate a unique invite token
    const inviteToken = crypto.randomBytes(20).toString("hex");

    const sharedPerson = new Person({ name, email, inviteToken });
    await sharedPerson.save();

    const inviteLink = `http://localhost:3000/register?token=${inviteToken}`;

    // Prepare email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "You have a new invite!",
      text: `Hello ${name},\n\nYou have been invited! Click here to register: ${inviteLink}`,
      html: `
        <p>Hello <b>${name}</b>,</p>
        <p>You have been invited! 🎉</p>
        <p><a href="${inviteLink}">Click here to accept the invite</a></p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.redirect("/");
  } catch (err) {
    console.error("Share invite error:", err);
    res.status(500).send("Failed to share invite");
  }
});

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

    // ✅ Ensure sharedWith exists
    if (!Array.isArray(todo.sharedWith)) {
      todo.sharedWith = [];
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

const { getUserRole } = require("../middleware/permissions");

userApp.post("/todos/:id/update", requireLogin, async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).send("Todo not found");

    const role = getUserRole(todo, req.session.user.name);

    if (!role || (role !== "owner" && role !== "editor")) {
      return res.status(403).send("No permission to edit");
    }

    todo.title = req.body.title;
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Update failed");
  }
});

module.exports = userApp;
