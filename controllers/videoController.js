const Video   = require('../models/Video');
const VideoView = require('../models/VideoView');
const Channel = require('../models/Channel');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { uploadFileToB2 } = require('../config/backblaze');
const { getVideoDuration } = require('../utils/mediaHelper');

// POST /api/videos/upload
exports.uploadVideo = async (req, res) => {
  try {
    const uploaderId = req.user._id;
    const channelId  = req.user.channelId;
    if (!channelId) return res.status(400).json({ message: 'User has no channel' });

    // 1) Required fields
    const { title, description = '', visibility = 'public' } = req.body;
    if (!title || !req.files?.videoFile?.[0]) {
      return res.status(400).json({ message: 'title and videoFile are required' });
    }

    // 2) Parse categories (must provide at least one)
    let categories = [];
    if (req.body.categories) {
      categories = typeof req.body.categories === 'string'
        ? req.body.categories.split(',').map(s => s.trim()).filter(s => s)
        : Array.isArray(req.body.categories)
          ? req.body.categories
          : [];
    }
    if (categories.length === 0) {
      return res.status(400).json({ message: 'At least one category is required' });
    }

    // 3) Parse tags (optional)
    let tags = [];
    if (req.body.tags) {
      tags = typeof req.body.tags === 'string'
        ? req.body.tags.split(',').map(t => t.trim()).filter(t => t)
        : Array.isArray(req.body.tags)
          ? req.body.tags
          : [];
    }

    // 4) Upload video file to B2
    const videoFile = req.files.videoFile[0];
    const videoKey  = `videos/${channelId}/${Date.now()}-${videoFile.originalname}`;

    // Compute size
    const sizeInMB = +(videoFile.buffer.length / (1024 * 1024)).toFixed(2);

    // Extract duration
    const duration = await getVideoDuration(videoFile.buffer, `tmp-${Date.now()}.mp4`);

    // Age restriction from client (default false)
    const isAgeRestricted = req.body.isAgeRestricted === 'true';

    const videoUrl  = await uploadFileToB2(videoKey, videoFile.buffer, videoFile.mimetype);

    // 5) Upload thumbnail if provided
    let thumbnailUrl = '';
    if (req.files.thumbnailImage?.[0]) {
      const thumb     = req.files.thumbnailImage[0];
      const thumbKey  = `thumbnails/${channelId}/${Date.now()}-${thumb.originalname}`;
      thumbnailUrl    = await uploadFileToB2(thumbKey, thumb.buffer, thumb.mimetype);
    }

    // 6) Create Video document
    const created = await Video.create({
      title,
      description,
      channelId,
      uploader: uploaderId,
      categories,
      tags,
      visibility,
      videoUrls: {
        original:   videoUrl,
        resolutions:{}
      },
      thumbnailUrl,
      duration,
      sizeInMB,
      isAgeRestricted
    });

    // 7) Link video to Channel
    await Channel.findByIdAndUpdate(channelId, { $push: { videos: created._id } });

    // 8) Re-fetch with populate so we return the same shape clients expect:
    const video = await Video.findById(created._id)
      .populate('channelId', 'name profilePictureUrl handleChannelName')
      .populate('uploader', 'firstName lastName');

    return res.status(201).json(video);

  } catch (error) {
    console.error('uploadVideo error:', error);
    res.status(500).json({ message: 'Video upload failed', error: error.message });
  }
};

// Get all videos of current or else user
exports.listVideos = async (req, res) => {
  try {
    // 1) Resolve requestedChannel: query param or user’s own channel
    const requestedChannel = req.query.channelId;
    const ownChannelId     = req.user?.channelId?.toString();

    // 2) Build base filter
    const filter = {};

    if (requestedChannel) {
      // a) If channelId is specified, filter by it
      filter.channelId = requestedChannel;

      // b) If it’s not your own channel, only include public videos
      if (requestedChannel !== ownChannelId) {
        filter.visibility = 'public';
      }
    } else {
      // No channelId ⇒ global feed ⇒ only public videos
      filter.visibility = 'public';
    }

    // 3) Optional extra filters
    if (req.query.category) {
      filter.categories = req.query.category;
    }
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }

    // 4) Pagination
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    // 5) Execute count + find in parallel
    const [ total, videos ] = await Promise.all([
      Video.countDocuments(filter),
      Video.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('channelId', 'name profilePictureUrl handleChannelName')
        .populate('uploader',  'firstName lastName')
    ]);

    const totalPages = Math.ceil(total / limit);

    // 6) Return standardized paging response
    return res.json({
      page,
      totalPages,
      totalVideos: total,
      videos
    });

  } catch (err) {
    console.error('listVideos error:', err);
    return res.status(500).json({
      message: 'Could not list videos',
      error: err.message
    });
  }
};

// GET /api/videos/:videoId
exports.getVideoById = async (req, res) => {
  const { videoId } = req.params;
  const isEditRequest = req.query.edit === 'true';
  const isOwner = req.user && req.user._id;

  const video = await Video.findById(videoId)
    .populate('channelId', 'name profilePictureUrl handleChannelName')
    .populate('uploader', 'firstName lastName');

  if (!video) {
    return res.status(404).json({ message: 'Video not found' });
  }

  // Check if current user is the video owner
  const isVideoOwner = isOwner && video.uploader._id.toString() === req.user._id.toString();

  // Bypass visibility check for edit requests or owners
  if (video.visibility === 'private' && !isEditRequest && !isVideoOwner) {
    return res.status(403).json({ message: 'This video is private' });
  }

  // Increment view count ONLY for:
  // - Non-edit requests
  // - Non-owner viewers
  if (!isEditRequest && !isVideoOwner) {
    video.views++;
    await video.save();
  }

  res.json(video);
};

// add a view
exports.addView = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user has viewed this video in the last 24 hours
    const recentView = await VideoView.findOne({
      userId,
      videoId,
      viewedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours
    });

    if (!recentView) {
      video.views += 1;
      await video.save();

      await VideoView.create({ userId, videoId });
    }

    res.status(200).json({ message: 'View counted if not recently viewed' });
  } catch (error) {
    console.error('Error adding view:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/videos/:videoId
exports.updateVideo = async (req, res) => {
  const { videoId } = req.params;
  const userId     = req.user._id;

  const video = await Video.findById(videoId);
  if (!video) return res.status(404).json({ message: 'Video not found' });
  if (video.uploader.toString() !== userId.toString())
    return res.status(403).json({ message: 'Not authorized to edit this video' });

  // Build your updates object exactly as you already do…
  const updates = {};
  const allowed = ['title','description','visibility','isAgeRestricted'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (req.body.tags) {
    updates.tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : req.body.tags.split(',').map(t => t.trim()).filter(t => t);
  }

  if (req.body.categories) {
    updates.categories = Array.isArray(req.body.categories)
      ? req.body.categories
      : req.body.categories.split(',').map(c => c.trim()).filter(c => c);
  }

  if (req.file) {
    const file = req.file;
    const key  = `thumbnails/${video.channelId}/${Date.now()}-${file.originalname}`;
    updates.thumbnailUrl = await uploadFileToB2(key, file.buffer, file.mimetype);
  }

  // 1) Apply updates
  await Video.findByIdAndUpdate(videoId, updates);

  // 2) Re‑fetch with the same populate logic you use on uploadVideo
  const updated = await Video.findById(videoId)
    .populate('channelId', 'name profilePictureUrl handleChannelName')
    .populate('uploader',    'firstName lastName');

  // 3) Return the fully populated object
  return res.json(updated);
};

// DELETE /api/videos/:videoId
exports.deleteVideo = async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: 'Video not found' });
  }

  if (video.uploader.toString() !== userId.toString()) {
    return res.status(403).json({ message: 'Not authorized to delete this video' });
  }

  // Delete video document
  await Video.deleteOne({ _id: videoId });

  // Remove reference from Channel.videos array
  await Channel.findByIdAndUpdate(video.channelId, {
    $pull: { videos: video._id }
  });

  res.json({ message: 'Video deleted successfully' });
};

/**
 * 1A) Like Video
 */
exports.likeVideo = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;
  const v = await Video.findById(videoId);
  if (!v) return res.status(404).json({ message: 'Video not found' });

  // Toggle like
  const liked   = v.likes.includes(userId);
  if (liked) {
    v.likes.pull(userId);
    await User.findByIdAndUpdate(userId, { $pull: { likedVideos: videoId } });
  } else {
    v.likes.addToSet(userId);
    v.dislikes.pull(userId); // remove any existing dislike
    await User.findByIdAndUpdate(userId, {
      $addToSet: { likedVideos: videoId },
      $pull:   { dislikedVideos: videoId }
    });
  }
  await v.save();
  res.json({ likes: v.likes.length, dislikes: v.dislikes.length, liked: !liked });
};

/**
 * 1B) Dislike Video
 */
exports.dislikeVideo = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;
  const v = await Video.findById(videoId);
  if (!v) return res.status(404).json({ message: 'Video not found' });

  const disliked = v.dislikes.includes(userId);
  if (disliked) {
    v.dislikes.pull(userId);
    await User.findByIdAndUpdate(userId, { $pull: { dislikedVideos: videoId } });
  } else {
    v.dislikes.addToSet(userId);
    v.likes.pull(userId);
    await User.findByIdAndUpdate(userId, {
      $addToSet: { dislikedVideos: videoId },
      $pull:    { likedVideos: videoId }
    });
  }
  await v.save();
  res.json({ likes: v.likes.length, dislikes: v.dislikes.length, disliked: !disliked });
};

/**
 * 2A) Add Comment
 */
exports.addComment = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Comment text is required' });

  const v = await Video.findById(videoId);
  if (!v) return res.status(404).json({ message: 'Video not found' });

  const comment = await Comment.create({
    videoId,
    userId,
    content: text
  });

  v.comments.addToSet(comment._id);
  await v.save();

  res.status(201).json(comment);
};

/**
 * 2B) Get Comments
 */
exports.getComments = async (req, res) => {
  const { videoId } = req.params;
  const comments = await Comment.find({ videoId })
    .sort('createdAt')
    .populate('userId', 'firstName lastName profilePictureUrl');
  res.json(comments);
};

/**
 * 3A) Watch History
 */
exports.addWatchHistory = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;

  // 1) Remove if already present
  await User.findByIdAndUpdate(userId, {
    $pull: { watchHistory: videoId }
  });

  // 2) Add to front
  await User.findByIdAndUpdate(userId, {
    $push: { watchHistory: { $each: [videoId], $position: 0 } }
  });

  res.json({ message: 'Added to watch history' });
};

/**
 * 3B) Save for Later
 */
exports.saveForLater = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;

  // Toggle save
  const user = await User.findById(userId);
  const saved = user.savedVideos.includes(videoId);

  if (saved) {
    await User.findByIdAndUpdate(userId, { $pull: { savedVideos: videoId } });
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { savedVideos: videoId } });
  }

  res.json({ saved: !saved });
};

/**
 * 3C) Download Tracking
 */
exports.addDownload = async (req, res) => {
  const userId = req.user._id;
  const { videoId } = req.params;

  // Record download (no toggle)
  await User.findByIdAndUpdate(userId, { $addToSet: { downloadedVideos: videoId } });

  res.json({ message: 'Download recorded' });
};

/**
 * Get Watch History Videos
 */
exports.getWatchHistory = async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate({
    path: 'watchHistory',
    populate: { path: 'channelId', select: 'name profilePictureUrl' }
  });

  res.json({ videos: user.watchHistory });
};

/**
 * Get Saved Videos
 */
exports.getSavedVideos = async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate({
    path: 'savedVideos',
    populate: { path: 'channelId', select: 'name profilePictureUrl' }
  });

  res.json({ videos: user.savedVideos });
};

/**
 * Get Downloaded Videos
 */
exports.getDownloadedVideos = async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate({
    path: 'downloadedVideos',
    populate: { path: 'channelId', select: 'name profilePictureUrl' }
  });

  res.json({ videos: user.downloadedVideos });
};

/**
 * Delete Comment
 */
exports.deleteComment = async (req, res) => {
  const userId = req.user._id;
  const { videoId, commentId } = req.params;

  // Ensure video exists
  const v = await Video.findById(videoId);
  if (!v) return res.status(404).json({ message: 'Video not found' });

  // Find comment
  const comment = await Comment.findById(commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  // Only comment author or video owner can delete
  if (comment.userId.toString() !== userId.toString() && v.uploader.toString() !== userId.toString()) {
    return res.status(403).json({ message: 'Not authorized to delete this comment' });
  }

  // Remove from video.comments array
  v.comments.pull(commentId);
  await v.save();

  // Delete comment document
  await Comment.findByIdAndDelete(commentId);

  res.json({ message: 'Comment deleted' });
};