const { uploadFileToB2 } = require("../config/backblaze");
const Channel = require("../models/Channel");
const User = require("../models/User");
const Video = require("../models/Video");
const slugify = require("slugify");
const crypto = require("crypto");

// Create Channel
exports.createChannel = async (req, res) => {
  const ownerId = req.user._id;
  const { name, description } = req.body;

  // 1) Prevent duplicate channels
  if (await Channel.exists({ ownerId })) {
    return res.status(400).json({ message: "Channel already exists" });
  }

  // 2) Handle channel handle: slug + random suffix
  let baseHandle = slugify(name, { lower: true, strict: true });
  const suffix = crypto.randomBytes(3).toString("hex");
  const handleChannelName = `${baseHandle}-${suffix}`;

  // 3) Upload profileImage if provided
  let profilePictureUrl = "";
  if (req.file) {
    const folder = `channel_pictures/${ownerId}`;
    // Use `originalname` and `mimetype`
    const fileName = `${folder}/${Date.now()}-${req.file.originalname}`;
    profilePictureUrl = await uploadFileToB2(
      fileName,
      req.file.buffer,
      req.file.mimetype // <-- correct
    );
  }

  // 4) Create Channel
  const channel = await Channel.create({
    ownerId,
    name,
    description,
    profilePictureUrl,
    handleChannelName,
  });

  // 5) Link channel back to user
  await User.findByIdAndUpdate(ownerId, { channelId: channel._id });

  res.status(201).json(channel);
};

// Update Channel
exports.updateChannel = async (req, res) => {
  const { channelId } = req.params;

  // Check if the user owns the channel
  if (!req.user.channelId || req.user.channelId.toString() !== channelId) {
    return res.status(403).json({ message: "Unauthorized: Not your channel" });
  }

  const updates = {};
  const allowedFields = [
    "name",
    "description",
    "tags",
    "location",
    "contactEmail",
  ];

  for (let field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Handle socialLinks JSON
  if (req.body.socialLinks) {
    try {
      // If sent as JSON string, parse it; otherwise assume it’s already an object
      updates.socialLinks =
        typeof req.body.socialLinks === "string"
          ? JSON.parse(req.body.socialLinks)
          : req.body.socialLinks;
    } catch (e) {
      return res.status(400).json({ message: "Invalid JSON for socialLinks" });
    }
  }

  // Handle tags
  if (req.body.tags) {
    updates.tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : req.body.tags.split(",").map((t) => t.trim());
  }

  // Handle optional profile image upload
  if (req.files?.profileImage?.[0]) {
    const file = req.files.profileImage[0];
    const fileName = `channel_pictures/${req.user._id}/${Date.now()}-${
      file.originalname
    }`;
    updates.profilePictureUrl = await uploadFileToB2(
      fileName,
      file.buffer,
      file.mimetype
    );
  }

  // Handle optional banner image upload
  if (req.files?.bannerImage?.[0]) {
    const file = req.files.bannerImage[0];
    const fileName = `channel_banners/${req.user._id}/${Date.now()}-${
      file.originalname
    }`;
    updates.bannerUrl = await uploadFileToB2(
      fileName,
      file.buffer,
      file.mimetype
    );
  }

  // Handle optional handle update (restrict if needed)
  if (req.body.handleChannelName) {
    const existing = await Channel.findOne({
      handleChannelName: req.body.handleChannelName,
    });
    if (existing && existing._id.toString() !== channelId) {
      return res.status(400).json({ message: "Handle already taken" });
    }
    updates.handleChannelName = req.body.handleChannelName;
  }

  const updatedChannel = await Channel.findByIdAndUpdate(channelId, updates, {
    new: true,
  });
  res.json(updatedChannel);
};

// Show or get Channel
exports.getPublicChannel = async (req, res) => {
  const { identifier } = req.params;

  let channel;
  if (identifier.length === 24) {
    channel = await Channel.findById(identifier);
  } else {
    channel = await Channel.findOne({ handleChannelName: identifier });
  }

  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  const videoIds = channel.videos.map(id => id.toString());

  res.json({
    _id: channel._id,
    name: channel.name,
    description: channel.description,
    profilePictureUrl: channel.profilePictureUrl,
    bannerUrl: channel.bannerUrl,
    handleChannelName: channel.handleChannelName,
    socialLinks: channel.socialLinks || {},
    totalSubscribers: channel.totalSubscribers || 0,
    videos: videoIds,
    totalViews: channel.totalViews || 0,
    location: channel.location,
    contactEmail: channel.contactEmail,
    tags: channel.tags || []
  });
};

// — Subscribe endpoint —
exports.subscribe = async (req, res) => {
  const userId    = req.user._id.toString();
  const channelId = req.params.channelId;

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }
  if (channel.ownerId.toString() === userId) {
    return res.status(400).json({ message: "Cannot subscribe to your own channel" });
  }
  if (channel.subscribers.includes(userId)) {
    // idempotent: already subscribed
    return res.json({ subscribed: true, totalSubscribers: channel.totalSubscribers });
  }

  channel.subscribers.addToSet(userId);
  channel.totalSubscribers++;
  await channel.save();

  // also update user's subscribedChannels
  await User.findByIdAndUpdate(userId, { $addToSet: { subscribedChannels: channelId } });

  res.json({ subscribed: true, totalSubscribers: channel.totalSubscribers });
};

// — Unsubscribe endpoint —
exports.unsubscribe = async (req, res) => {
  const userId    = req.user._id.toString();
  const channelId = req.params.channelId;

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }
  if (!channel.subscribers.includes(userId)) {
    // idempotent: not subscribed
    return res.json({ subscribed: false, totalSubscribers: channel.totalSubscribers });
  }

  channel.subscribers.pull(userId);
  channel.totalSubscribers = Math.max(0, channel.totalSubscribers - 1);
  await channel.save();

  // also update user's subscribedChannels
  await User.findByIdAndUpdate(userId, { $pull: { subscribedChannels: channelId } });

  res.json({ subscribed: false, totalSubscribers: channel.totalSubscribers });
};

// Show subscribed channel
exports.getMySubscriptions = async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId)
    .populate({
      path: 'subscribedChannels',
      select: 'name description profilePictureUrl handleChannelName totalSubscribers videos',
      populate: {
        path: 'videos',
        select: '_id title thumbnailUrl'
      }
    });

  res.json(user.subscribedChannels);
};