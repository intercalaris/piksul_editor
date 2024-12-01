const path = require("path");
const fs = require("fs").promises; // Using fs.promises for async file operations
const db = require("../config/databaseConfig");
const ProjectModel = require("../models/ProjectModel");

module.exports = {
  getIndex: (req, res) => {
    res.render("index.ejs");
  },

  getEditor: (req, res) => {
    res.render("editor.ejs");
  },

  getGallery: async (req, res) => {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM projects ORDER BY created_at DESC", (err, rows) => {
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
      await fs.access(filePath); // Check if the file exists
      res.sendFile(filePath);
    } catch (err) {
      console.error("Image not found:", filePath);
      res.status(404).send("Image not found");
    }
  },

  getProfile: async (req, res) => {
    try {
      const projects = await ProjectModel.find({ user: req.user.id });
      res.render("profile.ejs", { projects, user: req.user });
    } catch (err) {
      console.error("Error retrieving profile:", err);
    }
  },

  createOrUpdateProject: async (req, res) => {
    const { grid_size, tolerance, project_id } = req.body;
    const originalImage = req.files.original_image[0];
    const editedImage = req.files.edited_image[0];

    try {
      if (project_id) {
        // Update existing project
        const { originalImagePath, editedImagePath } = await ProjectModel.saveImages(project_id, originalImage, editedImage);
        await ProjectModel.updateProject(project_id, originalImagePath, editedImagePath, grid_size, tolerance);
        res.json({ project_id, message: "Project updated successfully" });
      } else {
        // Insert a new project
        const newProjectId = await ProjectModel.insertProject(grid_size, tolerance);
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
  // getFeed: async (req, res) => {
  //   try {
  //     const projects = await Project.find().sort({ createdAt: "desc" }).lean();
  //     res.render("feed.ejs", { projects: projects });
  //   } catch (err) {
  //     console.log(err);
  //   }
  // },

  // getProject: async (req, res) => {
  //   try {
  //     const project = await Project.findById(req.params.id);
  //     res.render("projects.ejs", { project: project, user: req.user });
  //   } catch (err) {
  //     console.log(err);
  //   }
  // },

  // createProject: async (req, res) => {
  //   try {
  //     // Upload image to cloudinary
  //     const result = await cloudinary.uploader.upload(req.file.path);

  //     await Project.create({
  //       title: req.body.title,
  //       image: result.secure_url,
  //       cloudinaryId: result.public_id,
  //       caption: req.body.caption,
  //       likes: 0,
  //       user: req.user.id,
  //     });
  //     console.log("Project has been added!");
  //     res.redirect("/profile");
  //   } catch (err) {
  //     console.log(err);
  //   }
  // },

  // deleteProject: async (req, res) => {
  //   try {
  //     // Find project by id
  //     let project = await Project.findById({ _id: req.params.id });
  //     // Delete image from cloudinary
  //     await cloudinary.uploader.destroy(project.cloudinaryId);
  //     // Delete post from db
  //     await Project.remove({ _id: req.params.id });
  //     console.log("Deleted Project");
  //     res.redirect("/profile");
  //   } catch (err) {
  //     res.redirect("/profile");
  //   }
  // },
};
