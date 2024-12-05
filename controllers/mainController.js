const path = require("path");
const db = require("../config/databaseConfig");
const ProjectModel = require("../models/ProjectModel");

module.exports = {
  getIndex: (req, res) => {
    res.render("index.ejs");
  },

  getEditor: (req, res) => {
    res.render('editor.ejs', { 
      project: { id: '', original_image: '', grid_size: '' } 
    });
  },


  openInEditor: async (req, res) => {
    const id = req.params.id;
    try {
      const project = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM projects WHERE id = ?", [id], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
      if (!project) {
        return res.status(404).send("Project not found");
      }
      res.render("editor.ejs", { project });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).send("Error loading project");
    }
  },
  






  getGallery: async (req, res) => {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM projects WHERE user_id IS NULL ORDER BY created_at DESC", (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
  
      const projects = rows.map((project) => ({
        id: project.id,
        original_image: project.original_image,
        edited_image: project.edited_image,
        grid_size: project.grid_size,
        tolerance: project.tolerance,
        created_at: project.created_at,
      }));
  
      res.render("gallery", { projects });
    } catch (err) {
      console.error("Error retrieving projects:", err);
      res.status(500).send("Database error");
    }
  },
  
  getImage: async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../data/img", filename);

    try {
      // Serve the requested image
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error sending image file:", filePath, err);
          res.status(404).send("Image not found");
        }
      });
    } catch (err) {
      console.error("Error accessing image:", err);
      res.status(500).send("Failed to retrieve image");
    }
  },

  createOrUpdateProject: async (req, res) => {
    const { grid_size, tolerance, project_id } = req.body;
    const originalImage = req.files.original_image[0];
    const editedImage = req.files.edited_image[0];
    const userId = req.user ? req.user.id : null; // Set userId to null if guest
  
    try {
      if (project_id) {
        // Update existing project
        const { originalImagePath, editedImagePath } = await ProjectModel.saveImages(project_id, originalImage, editedImage);
        await ProjectModel.updateProject(project_id, originalImagePath, editedImagePath, grid_size, tolerance);
        res.json({ project_id, message: "Project updated successfully" });
      } else {
        // Insert a new project
        const newProjectId = await ProjectModel.insertProject(grid_size, tolerance, userId);
        const { originalImagePath, editedImagePath } = await ProjectModel.saveImages(newProjectId, originalImage, editedImage);
        await ProjectModel.updateProject(newProjectId, originalImagePath, editedImagePath, grid_size, tolerance);
        res.json({ project_id: newProjectId, message: "Project saved successfully" });
      }
    } catch (err) {
      console.error("Error processing project:", err);
      res.status(500).json({ error: "An error occurred while processing the project" });
    }
  },
  

  deleteProject: async (req, res) => {
    const projectID = req.params.id;
    try {
      // Delete project from database
      await ProjectModel.deleteProject(projectID);
      // Delete associated image files
      await ProjectModel.deleteProjectImages(projectID);
      console.log(`Project ${projectID} deleted.`);
      res.send(`Project ${projectID} deleted.`);
    } catch (err) {
      console.error("Error deleting project:", err);
      res.status(500).send("Failed to delete project");
    }
  },

  getProfile: async (req, res) => {
    if (!req.user) {
      return res.redirect("/login");
    }
  
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC", [req.user.id], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
  
      const projects = rows.map((project) => ({
        id: project.id,
        original_image: project.original_image,
        edited_image: project.edited_image,
        grid_size: project.grid_size,
        tolerance: project.tolerance,
        created_at: project.created_at,
      }));
  
      res.render("profile", { projects, user: req.user });
    } catch (err) {
      console.error("Error retrieving profile:", err);
      res.status(500).send("Database error");
    }
  },
  
};


