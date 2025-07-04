const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetCode: { type: String },
  resetCodeExpiry: { type: Date },
  profilePictureUrl: { type: String, default: "" },
  bio: { type: String, default: "" },
  joinedAt: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  subscribersCount: { type: Number, default: 0 },
  subscribedChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],
  watchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  downloadedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  playlists: [{ type: mongoose.Schema.Types.ObjectId, ref: "Playlist" }],
  likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  dislikedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  savedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
  lastActiveAt: { type: Date, default: Date.now },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel"
  },
});

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
