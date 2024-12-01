const path = require("path");
const fs = require("fs");
const db = require("../config/databaseConfig");
const ProjectModel = require("../models/ProjectModel");

module.exports = {
  getIndex: (req, res) => {
    res.render("index.ejs");
  },
  getEditor: (req, res) => {
    res.render("editor.ejs");
  },
  getGallery: (req, res) => {
    db.all("SELECT * FROM projects ORDER BY created_at DESC", (err, rows) => {
      if (err) {
        console.error("Error retrieving projects:", err);
        return res.status(500).send("Database error");
      }
      const projects = rows.map((project) => ({
        id: project.id,
        original_image: project.original_image,
        edited_image: project.edited_image,
        grid_size: project.grid_size,
        tolerance: project.tolerance,
        created_at: project.created_at,
      }));
      res.render("gallery", { projects });
    });
  },

  getImage: (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../data/img", filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error("Image not found:", filePath);
        return res.status(404).send("Image not found");
      }
      res.sendFile(filePath);
    });
  },

  getProfile: async (req, res) => {
    try {
      const projects = await ProjectModel.find({ user: req.user.id });
      res.render("profile.ejs", { projects: projects, user: req.user });
    } catch (err) {
      console.log(err);
    }
  },

  createOrUpdateProject: (req, res) => {
    const { grid_size, tolerance, project_id } = req.body;
    const originalImage = req.files.original_image[0];
    const editedImage = req.files.edited_image[0];

    const handleError = (err, message) => {
      console.error(message, err);
      return res.status(500).json({ error: message });
    };

    if (project_id) {
      // Update existing project
      const { originalImagePath, editedImagePath } = ProjectModel.saveImages(project_id, originalImage, editedImage);

      ProjectModel.updateProject(
        project_id,
        originalImagePath,
        editedImagePath,
        grid_size,
        tolerance,
        (err) => {
          if (err) return handleError(err, "Database update error");
          res.json({ project_id, message: "Project updated successfully" });
        }
      );
    } else {
      // Insert a new project
      ProjectModel.insertProject(grid_size, tolerance, (err, newProjectId) => {
        if (err) return handleError(err, "Database insertion error");

        const { originalImagePath, editedImagePath } = ProjectModel.saveImages(newProjectId, originalImage, editedImage);

        ProjectModel.updateProject(
          newProjectId,
          originalImagePath,
          editedImagePath,
          grid_size,
          tolerance,
          (updateErr) => {
            if (updateErr) return handleError(updateErr, "Database update error");
            res.json({ project_id: newProjectId, message: "Project saved successfully" });
          }
        );
      });
    }
  },
};


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
