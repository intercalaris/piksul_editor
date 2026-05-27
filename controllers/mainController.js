const path = require("path");
const db = require("../config/databaseConfig");
const ProjectModel = require("../models/ProjectModel");
const sharp = require("sharp");

function medianCut(pixels, K) {
    function rangeOf(bucket) {
        let rMin=255,rMax=0,gMin=255,gMax=0,bMin=255,bMax=0;
        for (const [r,g,b] of bucket) {
            if (r<rMin)rMin=r; if (r>rMax)rMax=r;
            if (g<gMin)gMin=g; if (g>gMax)gMax=g;
            if (b<bMin)bMin=b; if (b>bMax)bMax=b;
        }
        return [rMax-rMin, gMax-gMin, bMax-bMin];
    }

    let buckets = [pixels.slice()];
    while (buckets.length < K) {
        let bestB = -1, bestCh = 0, bestRange = -1;
        for (let b = 0; b < buckets.length; b++) {
            if (buckets[b].length < 2) continue;
            const ranges = rangeOf(buckets[b]);
            for (let ch = 0; ch < 3; ch++) {
                if (ranges[ch] > bestRange) { bestRange = ranges[ch]; bestB = b; bestCh = ch; }
            }
        }
        if (bestB === -1 || bestRange === 0) break;
        const bucket = buckets[bestB];
        bucket.sort((a, b) => a[bestCh] - b[bestCh]);
        const mid = Math.floor(bucket.length / 2);
        buckets.splice(bestB, 1, bucket.slice(0, mid), bucket.slice(mid));
    }

    return buckets.map(bucket => [
        Math.round(bucket.reduce((s,p) => s+p[0], 0) / bucket.length),
        Math.round(bucket.reduce((s,p) => s+p[1], 0) / bucket.length),
        Math.round(bucket.reduce((s,p) => s+p[2], 0) / bucket.length),
    ]);
}

module.exports = {
    getIndex: (req, res) => {
        res.render("index.ejs");
    },

    getEditor: (req, res) => {
        res.render("editor.ejs", {
            project: {
                id: "",
                original_image: "",
                block_size: "",
                palette_size: "",
            },
        });
    },

    openInEditor: async (req, res) => {
        const id = req.params.id;
        try {
            const project = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM projects WHERE id = ?",
                    [id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
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

    openInSketch: async (req, res) => {
        const id = req.params.id;
        if (id === "new") {
            // if unsaved new project
            console.log(
                "Loading new project."
            );
			// edited image, block size, etc. loaded from local storage
            return res.render("sketch.ejs", {
                project: {
                    id: "",
                    edited_image: "", 
                    block_size: "", 
                    palette_size: "", 
                },
            });
        }
        try {
            // if saved project
            console.log("Fetching project with ID:", id);
            const project = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM projects WHERE id = ?",
                    [id],
                    (err, row) => {
                        if (err) {
                            console.error("Database error:", err);
                            return reject(err);
                        }
                        resolve(row);
                    }
                );
            });
            if (!project) {
                console.warn("Project not found for ID:", id);
                return res.status(404).send("Project not found");
            }
            console.log("Rendering sketch.ejs with project:", project);
            res.render("sketch.ejs", { project });
        } catch (error) {
            console.error("Error in openInSketch:", error);
            res.status(500).send("Error loading project");
        }
    },
	
    getGallery: async (req, res) => {
        try {
            const rows = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM projects WHERE user_id IS NULL ORDER BY created_at DESC",
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            });

            const projects = rows.map((project) => ({
                id: project.id,
                original_image: project.original_image,
                edited_image: project.edited_image,
                block_size: project.block_size,
                palette_size: project.palette_size,
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
        const { block_size, palette_size, tolerance, project_id } = req.body;
        const originalImage = req.files.original_image[0];
        const editedImage = req.files.edited_image[0];
        const userId = req.user ? req.user.id : null; // set userid to null if guest
      
        try {
          let id = project_id;
      
          // insert new project if no id provided
          if (!project_id) {
            id = await ProjectModel.insertProject(block_size, palette_size, tolerance, userId);
          }
      
          // save images and update project
          const { originalImagePath, editedImagePath } = await ProjectModel.saveImages(id, originalImage, editedImage);
          await ProjectModel.updateProject(id, originalImagePath, editedImagePath, block_size, palette_size, tolerance);
      
          res.json({
            project_id: id,
            message: project_id ? "Project updated successfully" : "Project created successfully",
          });
        } catch (err) {
          console.error("Error processing project:", err);
          res.status(500).json({
            error: "An error occurred while processing the project",
          });
        }
      },
      

    quantizeImage: async (req, res) => {
        if (!req.file) return res.status(400).send("No image provided");
        const K = Math.max(2, Math.min(256, parseInt(req.body.colors) || 16));
        try {
            const { data, info } = await sharp(req.file.buffer)
                .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            const pixels = [];
            for (let i = 0; i < data.length; i += 4)
                if (data[i+3] > 0) pixels.push([data[i], data[i+1], data[i+2]]);

            const palette = medianCut(pixels, K);

            const out = Buffer.from(data);
            for (let i = 0; i < out.length; i += 4) {
                if (out[i+3] === 0) continue;
                const pr = out[i], pg = out[i+1], pb = out[i+2];
                let best = 0, bestDist = Infinity;
                for (let j = 0; j < palette.length; j++) {
                    const dr = pr-palette[j][0], dg = pg-palette[j][1], db = pb-palette[j][2];
                    const d = dr*dr + dg*dg + db*db;
                    if (d < bestDist) { bestDist = d; best = j; }
                }
                out[i] = palette[best][0]; out[i+1] = palette[best][1]; out[i+2] = palette[best][2];
            }

            const result = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
                .png().toBuffer();
            res.set("Content-Type", "image/png");
            res.send(result);
        } catch (err) {
            console.error("Quantization error:", err);
            res.status(500).send("Quantization failed");
        }
    },

    deleteProject: async (req, res) => {
        const projectID = req.params.id;
        try {
            await ProjectModel.deleteProject(projectID);
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
                db.all(
                    "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
                    [req.user.id],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            });

            const projects = rows.map((project) => ({
                id: project.id,
                original_image: project.original_image,
                edited_image: project.edited_image,
                block_size: project.block_size,
                palette_size: project.palette_size,
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
