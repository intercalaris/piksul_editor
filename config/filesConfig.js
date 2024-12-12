const multer = require("multer");

const upload = multer({
  dest: "data/img/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 mb limit
});

module.exports = upload;