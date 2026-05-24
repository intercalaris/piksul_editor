const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');

const desiredSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER',
  original_image: 'TEXT',
  edited_image: 'TEXT',
  block_size: 'INTEGER',
  palette_size: 'INTEGER',
  tolerance: 'INTEGER',
  is_public: 'BOOLEAN DEFAULT 0',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
};

function migrateProjectsTable() {
  const db = new DatabaseSync(dbPath);
  console.log('Connected to SQLite database.');

  try {
    const rows = db.prepare(`PRAGMA table_info(projects)`).all();
    const existingColumns = rows.map((row) => row.name);

    const missingColumns = Object.keys(desiredSchema).filter(
      (column) => !existingColumns.includes(column)
    );

    if (missingColumns.length === 0) {
      console.log('No migration needed. The table is up-to-date.');
      return;
    }

    console.log(`Adding missing columns: ${missingColumns.join(', ')}`);

    missingColumns.forEach((column) => {
      const columnType = desiredSchema[column];
      db.prepare(`ALTER TABLE projects ADD COLUMN ${column} ${columnType}`).run();
      console.log(`Added column: ${column}`);
    });

    console.log('Migration completed.');
  } finally {
    db.close();
  }
}

migrateProjectsTable();
