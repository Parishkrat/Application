const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

const User = require("../models/user.js");
const Todo = require("../models/Todo.js");
const Person = require("../models/person.js");
const requireLogin = require("../middleware/auth.js");
const { getUserRole } = require("../middleware/permissions");

dotenv.config();
const userApp = express.Router();

// ================= AUTH ================= //

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
    const { name, email, password, token } = req.body;

    if (token) {
      const invitedPerson = await Person.findOne({ inviteToken: token });
      if (!invitedPerson) {
        return res.status(400).send("Invalid or expired invite link.");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });
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
      res.status(400).send("Email already registered");
    } else {
      console.error(err);
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
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).send("Cannot find user");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Incorrect password");

    req.session.user = { email: user.email, name: user.name };
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Login failed");
  }
});

// Logout
userApp.post("/users/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Logout failed");
    res.redirect("/login");
  });
});

// ================= EMAIL INVITE ================= //

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

userApp.post("/share-invite", requireLogin, async (req, res) => {
  try {
    const { name, email } = req.body;
    const inviteToken = crypto.randomBytes(20).toString("hex");

    const sharedPerson = new Person({
      name,
      email: email.toLowerCase(),
      inviteToken,
    });
    await sharedPerson.save();

    const inviteLink = `http://localhost:3000/register?token=${inviteToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "You have a new invite!",
      html: `
        <p>Hello <b>${name}</b>,</p>
        <p>You have been invited! 🎉</p>
        <p><a href="${inviteLink}">Click here to accept the invite</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.redirect("/");
  } catch (err) {
    console.error("Share invite error:", err);
    res.status(500).send("Failed to share invite");
  }
});

// ================= TODOS ================= //

// Home
userApp.get("/", requireLogin, async (req, res) => {
  try {
    const userEmail = req.session.user.email;

    const todos = await Todo.find({
      $or: [{ owner: userEmail }, { "sharedWith.email": userEmail }],
    });

    const people = await Person.find({});
    res.render("todos", { todos, people, userEmail });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load todos");
  }
});

userApp.get("/upgrade", requireLogin, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.user.email });
    res.render("upgrade", { user, razorpayKeyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Upgrade page error:", err);
    res.status(500).send("Unable to load upgrade page");
  }
});

// Share todo

userApp.post("/share", requireLogin, async (req, res) => {
  try {
    const { todoId, shareWithEmail, role } = req.body;
    const user = await User.findOne({ email: req.session.user.email });

    // Free users cannot share as editor
    if (!user.isPaid && role === "editor") {
      return res.redirect("/upgrade");
    }

    const validRoles = ["editor", "viewer"];
    if (!validRoles.includes(role)) return res.status(400).send("Invalid role");

    const todo = await Todo.findById(todoId);
    if (!todo) return res.status(404).send("Todo not found");

    if (todo.owner !== user.email) {
      return res.status(403).send("Only the owner can share");
    }

    const alreadyShared = todo.sharedWith.some(
      (u) => u.email === shareWithEmail.toLowerCase()
    );
    if (alreadyShared) return res.status(400).send("Already shared");

    todo.sharedWith.push({ email: shareWithEmail.toLowerCase(), role });
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Share error:", err);
    res.status(500).send("Share failed");
  }
});

// Update todo
userApp.post("/todos/:id/update", requireLogin, async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).send("Todo not found");

    const role = getUserRole(todo, req.session.user.email);

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

// Delete todo (owner only)
userApp.post("/todos/:id/delete", requireLogin, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      owner: req.session.user.email,
    });
    if (!todo) return res.status(404).send("Todo not found or not owned");

    res.redirect("/");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Delete failed");
  }
});

// Create a new todo
userApp.post("/todos", requireLogin, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.user.email });

    // Free users can only create 3
    if (!user.isPaid) {
      const count = await Todo.countDocuments({ owner: user.email });
      if (count >= 3) {
        return res.redirect("/upgrade");
      }
    }

    const todo = new Todo({
      title: req.body.title,
      owner: user.email,
      sharedWith: [],
    });
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Create todo error:", err);
    res.status(500).send("Failed to create todo");
  }
});

// Update role of a shared user
userApp.post("/share/update-role", requireLogin, async (req, res) => {
  try {
    const { todoId, shareWithEmail, role } = req.body;
    const validRoles = ["editor", "viewer"];
    if (!validRoles.includes(role)) return res.status(400).send("Invalid role");

    const todo = await Todo.findById(todoId);
    if (!todo) return res.status(404).send("Todo not found");

    // Only owner can change roles
    if (todo.owner !== req.session.user.email) {
      return res.status(403).send("Only the owner can change roles");
    }

    // Find the shared user and update role
    const sharedUser = todo.sharedWith.find(
      (u) => u.email === shareWithEmail.toLowerCase()
    );
    if (!sharedUser)
      return res.status(404).send("User not found in shared list");

    sharedUser.role = role;
    await todo.save();

    res.redirect("/");
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).send("Failed to update role");
  }
});

module.exports = userApp;
