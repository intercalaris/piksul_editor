const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const db = require("./databaseConfig"); // Import SQLite database connection

module.exports = function (passport) {
  // Local Strategy for authentication
  passport.use(
    new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
      db.get("SELECT * FROM users WHERE email = ?", [email.toLowerCase()], (err, user) => {
        if (err) return done(err); // Handle database errors
        if (!user) {
          return done(null, false, { msg: `Email ${email} not found.` });
        }

        // Check if passwords match using bcrypt
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) return done(err); // Handle bcrypt error
          if (isMatch) {
            return done(null, user); // Authentication successful
          }
          return done(null, false, { msg: "Invalid email or password." }); // Invalid password
        });
      });
    })
  );

  // Serialize and Deserialize User
  passport.serializeUser((user, done) => {
    done(null, user.id); // Store the user id in the session
  });

  passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => done(err, user)); // Fetch user by ID
  });

  // Authentication Middleware
  passport.ensureAuth = function (req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    } else {
      res.redirect("/login"); // Redirect to login if not authenticated
    }
  };

  passport.ensureGuest = function (req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    } else {
      res.redirect("/dashboard"); // Redirect to dashboard if already authenticated
    }
  };
};
