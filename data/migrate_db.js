const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');

const desiredSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER',
  original_image: 'TEXT',
  edited_image: 'TEXT',
  block_size: 'INTEGER',
  tolerance: 'INTEGER',
  is_public: 'BOOLEAN DEFAULT 0',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
};

function migrateProjectsTable() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      process.exit(1);
    } else {
      console.log('Connected to SQLite database.');
    }
  });

  db.all(`PRAGMA table_info(projects)`, (err, rows) => {
    if (err) {
      console.error('Error fetching schema:', err);
      db.close();
      return;
    }

    const existingColumns = rows.map((row) => row.name);

    const missingColumns = Object.keys(desiredSchema).filter(
      (column) => !existingColumns.includes(column)
    );

    if (missingColumns.length === 0) {
      console.log('No migration needed. The table is up-to-date.');
      db.close();
      return;
    }

    console.log(`Adding missing columns: ${missingColumns.join(', ')}`);

    missingColumns.forEach((column) => {
      const columnType = desiredSchema[column];
      db.run(
        `ALTER TABLE projects ADD COLUMN ${column} ${columnType}`,
        (err) => {
          if (err) {
            console.error(`Error adding column ${column}:`, err);
          } else {
            console.log(`Added column: ${column}`);
          }
        }
      );
    });


    db.close(() => {
      console.log('Migration completed and database closed.');
    });
  });
}

migrateProjectsTable();
