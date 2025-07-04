const mongoose = require('mongoose');

const WatchLaterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }]
}, { timestamps: true });

module.exports = mongoose.model('WatchLater', WatchLaterSchema);