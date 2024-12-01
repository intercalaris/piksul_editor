const bcrypt = require("bcryptjs");
const db = require("../config/databaseConfig"); // Reference to the SQLite DB

// Helper function to create a new user
const createUser = (userName, email, password, callback) => {
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return callback(err);

    db.run(
      `INSERT INTO users (userName, email, password) VALUES (?, ?, ?)`,
      [userName, email, hashedPassword],
      function (err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID, userName, email });
      }
    );
  });
};

// Helper function to find a user by email
const findUserByEmail = (email, callback) => {
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
};

// Helper function to find a user by ID
const findUserById = (id, callback) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
};

// Helper function to compare passwords
const comparePassword = (candidatePassword, storedPassword, callback) => {
  bcrypt.compare(candidatePassword, storedPassword, (err, isMatch) => {
    callback(err, isMatch);
  });
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  comparePassword
};
