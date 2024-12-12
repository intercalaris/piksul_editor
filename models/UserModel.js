const bcrypt = require("bcryptjs");
const db = require("../config/databaseConfig");

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

const findUserByEmail = (email, callback) => {
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
};

const findUserById = (id, callback) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
};

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
