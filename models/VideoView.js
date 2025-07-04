const mongoose = require('mongoose');

const VideoViewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  viewedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VideoView', VideoViewSchema);
