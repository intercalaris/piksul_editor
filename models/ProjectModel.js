const path = require("path");
const fs = require("fs").promises;
const db = require("../config/databaseConfig");

// Save image files for project
const saveImages = async (id, originalImage, editedImage) => {
  const originalImagePath = path.join("data/img", `${id}_original.png`);
  const editedImagePath = path.join("data/img", `${id}_edited.png`);
  await fs.rename(originalImage.path, originalImagePath);
  await fs.rename(editedImage.path, editedImagePath);
  return { originalImagePath, editedImagePath };
};

// Insert new project
const insertProject = async (blockSize, tolerance, userId = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO projects (user_id, original_image, edited_image, block_size, tolerance) VALUES (?, ?, ?, ?, ?)`,
      [userId, "placeholder", "placeholder", parseInt(blockSize, 10), parseInt(tolerance, 10)],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID); // Return new project ID
      }
    );
  });
};

// Update existing project
const updateProject = async (id, originalImagePath, editedImagePath, blockSize, tolerance) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE projects 
       SET original_image = ?, edited_image = ?, block_size = ?, tolerance = ?, created_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [path.basename(originalImagePath), path.basename(editedImagePath), parseInt(blockSize, 10), parseInt(tolerance, 10), id],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};

// Delete project from database
const deleteProject = async (projectID) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM projects WHERE id = ?", [projectID], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// Delete associated image files
const deleteProjectImages = async (projectID) => {
  const originalImagePath = path.join("data/img", `${projectID}_original.png`);
  const editedImagePath = path.join("data/img", `${projectID}_edited.png`);
  try {
    await fs.unlink(originalImagePath);
    await fs.unlink(editedImagePath);
  } catch (err) {
    // Ignore file not found errors but log others
    if (err.code !== "ENOENT") {
      console.error(`Error deleting file: ${err.message}`);
    }
  }
};

module.exports = {
  saveImages,
  insertProject,
  updateProject,
  deleteProject,
  deleteProjectImages,
};
