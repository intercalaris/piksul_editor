const path = require("path");
const fs = require("fs");
const db = require("../config/databaseConfig");

// Save image files for a project
const saveImages = (id, originalImage, editedImage) => {
  const originalImagePath = path.join("data/img", `${id}_original.png`);
  const editedImagePath = path.join("data/img", `${id}_edited.png`);

  fs.renameSync(originalImage.path, originalImagePath);
  fs.renameSync(editedImage.path, editedImagePath);

  return { originalImagePath, editedImagePath };
};

// Insert a new project
const insertProject = (gridSize, tolerance, callback) => {
  db.run(
    `INSERT INTO projects (original_image, edited_image, grid_size, tolerance) VALUES (?, ?, ?, ?)`,
    ["placeholder", "placeholder", parseInt(gridSize, 10), parseInt(tolerance, 10)],
    function (err) {
      if (err) return callback(err);
      callback(null, this.lastID); // Return the new project ID
    }
  );
};

// Update an existing project
const updateProject = (id, originalImagePath, editedImagePath, gridSize, tolerance, callback) => {
  db.run(
    `UPDATE projects 
     SET original_image = ?, edited_image = ?, grid_size = ?, tolerance = ?, created_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [path.basename(originalImagePath), path.basename(editedImagePath), parseInt(gridSize, 10), parseInt(tolerance, 10), id],
    (err) => callback(err)
  );
};

module.exports = {
  saveImages,
  insertProject,
  updateProject,
};
