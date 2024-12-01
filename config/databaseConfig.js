const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize SQLite database connection
const db = new sqlite3.Database(path.join(__dirname, '../data/database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1); // Exit if there's a connection issue
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Function to create tables (if they don’t exist)
function initDB() {

  // Create the users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create the projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_image TEXT,
      edited_image TEXT,
      grid_size INTEGER,
      tolerance INTEGER,
      is_public BOOLEAN DEFAULT 0, -- 0 for private, 1 for public
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
};

// Run the table creation logic when the app starts
initDB();

module.exports = db;
