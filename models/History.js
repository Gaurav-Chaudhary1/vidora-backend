const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  watchedAt: { type: Date, default: Date.now },
  progress: { type: Number, default: 0 } // seconds watched
});

module.exports = mongoose.model('History', HistorySchema);