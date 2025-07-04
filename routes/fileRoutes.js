// routes/fileRoutes.js
const router         = require("express").Router();
const protect        = require("../middlewares/auth");
const fileController = require("../controllers/fileController");

router.get("/signed-url", protect, fileController.getSignedUrl);

module.exports = router;