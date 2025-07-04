// routes/fileRoutes.js
const router         = require("express").Router();
const protect        = require("../middlewares/auth");
const fileController = require("../controllers/fileController");

router.post("/signed-url", protect, fileController.getSignedUrl);

module.exports = router;