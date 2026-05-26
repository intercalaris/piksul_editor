const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const storage = multer.diskStorage({
  destination: "data/img/",
  filename: (_req, _file, cb) => {
    cb(null, crypto.randomBytes(16).toString("hex") + ".png");
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 mb limit
});

module.exports = upload;