const express = require("express");
const router = express.Router();
const mainController = require("../controllers/mainController");
const upload = require("../config/filesConfig");
const multer = require("multer");
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Auth is intentionally dormant. Do not wire it into the current product
// unless account-based project storage becomes an active feature again.
if (process.env.ENABLE_AUTH === "true") {
    const userController = require("../controllers/userController");
    router.get("/login", userController.getLogin);
    router.post("/login", userController.postLogin);
    router.get("/logout", userController.logout);
    router.get("/signup", userController.getSignup);
    router.post("/signup", userController.postSignup);
} else {
    router.all(["/login", "/signup", "/logout"], (req, res) => {
        res.status(404).send("Accounts are not active in this version of Piksul.");
    });
}

// Navigation and Project Routes
router.get("/", mainController.getIndex);
router.get("/editor", mainController.getEditor);
router.get("/editor/:id", mainController.openInEditor);

router.get("/gallery", mainController.getGallery);
router.get("/gallery/image/:filename", mainController.getImage);

router.post("/projects", 
    upload.fields([{ name: "original_image" }, { name: "edited_image" }]),
    mainController.createOrUpdateProject);   

router.get("/sketch/:id", mainController.openInSketch);

router.post("/quantize", uploadMemory.single("image"), mainController.quantizeImage);

router.delete("/projects/:id", mainController.deleteProject);

module.exports = router;
