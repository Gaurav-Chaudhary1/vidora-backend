const mongoose = require('mongoose');

const SocialLinksSchema = new mongoose.Schema({
  website: { type: String, default: '' },
  instagram: { type: String, default: '' },
  twitter: { type: String, default: '' },
  facebook: { type: String, default: '' },
  other: { type: String, default: '' }
}, { _id: false });

const ChannelSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // one channel per user for now
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: { type: String, default: '' },
  profilePictureUrl: { type: String, default: '' },
  bannerUrl: { type: String, default: '' },

  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  totalSubscribers: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },

  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],

  socialLinks: { type: SocialLinksSchema, default: () => ({}) },
  location: { type: String, default: 'India' },
  channelUrl: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  isMonetized: { type: Boolean, default: false },
  tags: [{ type: String }],
  handleChannelName: { type: String, required: true, unique: true, trim: true },
  contactEmail: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Channel', ChannelSchema);
