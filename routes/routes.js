const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const mainController = require("../controllers/mainController");
const { ensureAuth, ensureGuest } = require("../config/passportConfig");
const upload = require("../config/filesConfig");

// User Authentication Routes
router.get("/login", userController.getLogin);
router.post("/login", userController.postLogin);
router.get("/logout", userController.logout);
router.get("/signup", userController.getSignup);
router.post("/signup", userController.postSignup);

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
