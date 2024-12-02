const multer = require("multer");

const upload = multer({
  dest: "data/img/", // Static folder for uploads
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

module.exports = upload;