const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../data/img");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create temporary filename
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.tmp`;
    cb(null, uniqueName); 
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Only files of the following formats are supported: ${allowedExtensions.join(", ")}`), false);
  }
};

// Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB size limit
});

// Convert images to PNG using Sharp
const convertToPng = async (req, res, next) => {
  if (!req.files) return next();

  const imageFields = ["original_image", "edited_image"]; // Define fields to process
  const conversionPromises = [];

  for (const field of imageFields) {
    if (req.files[field]) {
      req.files[field].forEach((file) => {
        const inputPath = file.path;
        const outputPath = file.path.replace(/\.tmp$/, ".png");
        const conversion = sharp(inputPath)
          .toFormat("png")
          .toFile(outputPath)
          .then(() => {
            // Remove temp file after conversion
            fs.unlinkSync(inputPath);
            file.path = outputPath;
            file.filename = path.basename(outputPath);
          })
          .catch((err) => {
            console.error(`Error converting ${file.filename} to PNG:`, err);
            throw err;
          });

        conversionPromises.push(conversion);
      });
    }
  }

  try {
    await Promise.all(conversionPromises);
    next();
  } catch (error) {
    res.status(500).send("Error processing images");
  }
};

// Export Multer and PNG conversion middleware
module.exports = {
  upload,
  convertToPng,
};
