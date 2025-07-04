const { Router } = require("express");
const protect = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const { optionalAuth } = require("../middlewares/optionalAuth");
const videoController = require("../controllers/videoController");

const router = Router();

// POST /api/videos/upload
router.post(
  "/upload",
  protect,
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnailImage", maxCount: 1 },
  ]),
  videoController.uploadVideo
);

// Fetch user activity videos
router.get('/history', protect, videoController.getWatchHistory);
router.get('/saved', protect, videoController.getSavedVideos);
router.get('/downloads', protect, videoController.getDownloadedVideos);

// Get a single video (public)
router.get("/:videoId", optionalAuth, videoController.getVideoById);

// add a view
router.post('/:videoId/view', optionalAuth, videoController.addView);

// Get current or else user videos
router.get('/', protect, videoController.listVideos);

// Update video metadata & thumbnail (owner only)
router.put(
  "/:videoId",
  protect,
  upload.single("thumbnailImage"),
  videoController.updateVideo
);

// Delete video (owner only)
router.delete("/:videoId", protect, videoController.deleteVideo);

// 1) Like / Dislike
router.post("/:videoId/like", protect, videoController.likeVideo);
router.post("/:videoId/dislike", protect, videoController.dislikeVideo);

// 2) Comments
router.post("/:videoId/comment", protect, videoController.addComment);
router.get("/:videoId/comments", videoController.getComments);
router.delete("/:videoId/comments/:commentId", protect, videoController.deleteComment);

// 3) User activity
router.post("/:videoId/watch", protect, videoController.addWatchHistory);
router.post("/:videoId/save", protect, videoController.saveForLater);
router.post("/:videoId/download", protect, videoController.addDownload);

module.exports = router;
