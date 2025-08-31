const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const userApp = require("./Routers/LoginUser.js");
const todoRouter = require("./Routers/Todo_list.js");
const requireLogin = require("./middleware/auth.js");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Session middleware
app.use(
  session({
    secret: "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true if using HTTPS
  })
);

// Body parsers after session
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Mount user routes (login/signup) - no auth needed
app.use("/", userApp);

// Mount todos routes WITH requireLogin middleware
app.use("/todos", requireLogin, todoRouter);

// Start server after DB connection
mongoose
  .connect(DATABASE_URL)
  .then(() => {
    console.log("DATABASE CONNECTION SUCCESSFUL");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DATABASE CONNECTION FAILED", err);
  });
