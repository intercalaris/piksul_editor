const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../data/database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database.');
  }
});

function initDB() {

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      original_image TEXT,
      edited_image TEXT,
      block_size INTEGER,
      palette_size INTEGER,
      tolerance INTEGER,
      is_public BOOLEAN DEFAULT 0, -- 0 for private, 1 for public
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
};

initDB();

module.exports = db;
