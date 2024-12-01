const express = require("express");
const app = express();
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const methodOverride = require("method-override");
const flash = require("express-flash");
const logger = require("morgan");
const passport = require("passport");
const path = require("path");
const db = require("./config/databaseConfig"); // SQLite database setup
const mainRoutes = require("./routes/routes");

// Use .env file in config folder
require("dotenv").config({ path: "./config/.env" });

// Passport config
require("./config/passportConfig")(passport);

// Using EJS for views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static Folder
app.use(express.static("public"));

// Body Parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Logging
app.use(logger("dev"));

// Use forms for put/delete
app.use(methodOverride("_method"));

// Setup Sessions - stored in SQLite
app.use(
  session({
    secret: "tikvatenu",
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./data" }),
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Use flash messages for errors, info, etc.
app.use(flash());

// Setup Routes
app.use("/", mainRoutes);

// Server Running
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



// OLD SERVER.JS, NEEDS TO BE SPLIT UP


app.post('/gallery', upload.fields([{ name: 'original_image' }, { name: 'edited_image' }]), (req, res) => {
  const { grid_size, tolerance, project_id } = req.body;
  const originalImage = req.files.original_image[0];
  const editedImage = req.files.edited_image[0];
  const saveImages = (id) => {
      const originalImagePath = path.join('data/img', `${id}_original.png`);
      const editedImagePath = path.join('data/img', `${id}_edited.png`);
      fs.renameSync(originalImage.path, originalImagePath);
      fs.renameSync(editedImage.path, editedImagePath);
      return { originalImagePath, editedImagePath };
  };
  const handleError = (err, message) => {
      console.error(message, err);
      res.status(500).json({ error: message });
  };
  if (project_id) { // if project ID is established, pre-existing project
      const { originalImagePath, editedImagePath } = saveImages(project_id);
      db.run( // update project row
          `UPDATE projects 
           SET original_image = ?, edited_image = ?, grid_size = ?, tolerance = ?, created_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [path.basename(originalImagePath), path.basename(editedImagePath), parseInt(grid_size, 10), parseInt(tolerance, 10), project_id],
          (err) => {
              if (err) return handleError(err, 'Database update error');
              res.json({ project_id, message: 'Project updated successfully' });
          }
      );
  } else {
      // insert a new project
      db.run(
          `INSERT INTO projects (original_image, edited_image, grid_size, tolerance) VALUES (?, ?, ?, ?)`,
          ['placeholder', 'placeholder', parseInt(grid_size, 10), parseInt(tolerance, 10)],
          function (err) {
              if (err) return handleError(err, 'Database insertion error');

              const newProjectId = this.lastID;
              const { originalImagePath, editedImagePath } = saveImages(newProjectId);

              db.run(
                  `UPDATE projects 
                   SET original_image = ?, edited_image = ? 
                   WHERE id = ?`,
                  [path.basename(originalImagePath), path.basename(editedImagePath), newProjectId],
                  (updateErr) => {
                      if (updateErr) return handleError(updateErr, 'Database update error');
                      res.json({ project_id: newProjectId, message: 'Project saved successfully' });
                  }
              );
          }
      );
  }
});

app.delete('/gallery/:id', (req, res) => {
  const projectID = req.params.id;
  const originalImagePath = path.join(__dirname, 'data/img', `${projectID}_original.png`);
  const editedImagePath = path.join(__dirname, 'data/img', `${projectID}_edited.png`);
  // delete from SQL
  db.run('DELETE FROM projects WHERE id = ?', [projectID], (deleteErr) => {
    if (deleteErr) {
      console.error('Error deleting project from database:', deleteErr);
      return res.status(500).send('Failed to delete project');
    }
    // delete associated image files
    [originalImagePath, editedImagePath].forEach((filePath) => {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error(`Error deleting file ${filePath}:`, unlinkErr);
        }
      });
    });
    console.log(`Project ${projectID} deleted.`);
    res.send(`Project ${projectID} deleted.`);
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
