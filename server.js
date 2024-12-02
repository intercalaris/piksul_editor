const express = require("express");
const app = express();
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const methodOverride = require("method-override");
const flash = require("express-flash");
const logger = require("morgan");
const passport = require("passport");
const path = require("path");
const db = require("./config/databaseConfig"); // SQLite database setup
const mainRoutes = require("./routes/routes");

// Use .env file in config folder
require("dotenv").config({ path: "./config/.env" });

// Passport config
require("./config/passportConfig")(passport);

// Using EJS for views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static Folder
app.use(express.static("public"));

// Body Parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Logging
app.use(logger("dev"));

// Use forms for put/delete
app.use(methodOverride("_method"));

// Setup Sessions - stored in SQLite
app.use(
  session({
    secret: "tikvatenu",
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./data" }),
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Use flash messages for errors, info, etc.
app.use(flash());

// Setup Routes
app.use("/", mainRoutes);

// Server Running
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});