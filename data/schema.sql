CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_image TEXT NOT NULL,
    snapped_image TEXT NOT NULL,
    grid_size INTEGER NOT NULL,
    tolerance INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
