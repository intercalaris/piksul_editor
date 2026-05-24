const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const database = new DatabaseSync(path.join(__dirname, '../data/database.sqlite'));
console.log('Connected to SQLite database.');

const normalizeParams = (params) => {
  if (typeof params === 'function' || params === undefined) return [];
  return Array.isArray(params) ? params : [params];
};

const normalizeCallback = (params, callback) => {
  if (typeof params === 'function') return params;
  return callback;
};

const db = {
  run(sql, params, callback) {
    const cb = normalizeCallback(params, callback);
    try {
      const result = database.prepare(sql).run(...normalizeParams(params));
      if (cb) {
        cb.call({
          changes: result.changes,
          lastID: Number(result.lastInsertRowid),
        }, null);
      }
    } catch (err) {
      if (cb) return cb(err);
      throw err;
    }
  },

  get(sql, params, callback) {
    const cb = normalizeCallback(params, callback);
    try {
      const row = database.prepare(sql).get(...normalizeParams(params));
      if (cb) cb(null, row);
      return row;
    } catch (err) {
      if (cb) return cb(err);
      throw err;
    }
  },

  all(sql, params, callback) {
    const cb = normalizeCallback(params, callback);
    try {
      const rows = database.prepare(sql).all(...normalizeParams(params));
      if (cb) cb(null, rows);
      return rows;
    } catch (err) {
      if (cb) return cb(err);
      throw err;
    }
  },

  close() {
    database.close();
  },
};

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
