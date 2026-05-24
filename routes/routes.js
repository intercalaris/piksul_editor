const express = require("express");
const router = express.Router();
const mainController = require("../controllers/mainController");
const upload = require("../config/filesConfig");

// Auth is intentionally dormant while Piksul remains a tool-first app.
// Set ENABLE_AUTH=true and restore auth dependencies when accounts become a product feature.
if (process.env.ENABLE_AUTH === "true") {
    const userController = require("../controllers/userController");
    router.get("/login", userController.getLogin);
    router.post("/login", userController.postLogin);
    router.get("/logout", userController.logout);
    router.get("/signup", userController.getSignup);
    router.post("/signup", userController.postSignup);
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

router.delete("/projects/:id", mainController.deleteProject);

// router.get("/profile", ensureAuth, mainController.getProfile);
// router.get("/feed", ensureAuth, mainController.getFeed);
// router.get("/:id", ensureAuth, mainController.getProject);
// router.post("/createProject", filesConfig.single("file"), mainController.createProject);
// router.delete("/deleteProject/:id", mainController.deleteProject);

module.exports = router;
