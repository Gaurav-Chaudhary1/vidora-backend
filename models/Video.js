const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categories: [{ type: String, required: true }],
  tags: [{ type: String }],
  visibility: { type: String, enum: ['public','private','unlisted'], default: 'public' },
  videoUrls: {
    original: { type: String, required: true },
    resolutions: { type: Map, of: String } // e.g. {'720p': url, '480p': url}
  },
  thumbnailUrl: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  sizeInMB: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  isMonetized: { type: Boolean, default: false },
  isAgeRestricted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Video', VideoSchema);