// controllers/searchController.js
const mongoose = require("mongoose");
const Channel = require("../models/Channel");
const Video = require("../models/Video");

/**
 * GET /api/search?query=...
 */
exports.searchAll = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ message: "Missing search query" });
    }
    // build case-insensitive regex
    const regex = new RegExp(
      query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    // 1) Try to find a matching channel by name or handle
    const channel = await Channel.findOne({
      $or: [{ name: regex }, { handleChannelName: regex }],
    }).lean();

    let channelVideos = [];
    if (channel) {
      // 2) Fetch that channel's videos
      const filter = { channelId: channel._id };
      // if not channel owner, only public
      if (req.user?.channelId?.toString() !== channel._id.toString()) {
        filter.visibility = "public";
      }
      channelVideos = await Video.find(filter)
        .sort({ createdAt: -1 })
        .populate({
          path: "channelId",
          select: "_id name handleChannelName profilePictureUrl",
        })
        .populate({
          path: "uploader",
          select: "_id firstName lastName",
        })
        .lean();
    }

    // 3) Always search for videos matching title or tags, excluding the above channel
    const vidFilter = {
      $and: [
        {
          $or: [{ title: regex }, { tags: regex }],
        },
        // if we already found a channel, exclude its videos
        ...(channel ? [{ channelId: { $ne: channel._id } }] : []),
      ],
    };
    // if video owner not same as user, only public
    if (req.user == null) {
      vidFilter.visibility = "public";
    } else {
      // also enforce if querying another channel
      // (this only applies when channel found or if user is not uploader)
      vidFilter.visibility = "public";
    }

    const videos = await Video.find(vidFilter)
      .sort({ createdAt: -1 })
      .populate({
        path: "channelId",
        select: "_id name handleChannelName profilePictureUrl",
      })
      .populate({
        path: "uploader",
        select: "_id firstName lastName",
      })
      .lean();

    // 4) If nothing at all, 404
    if (!channel && videos.length === 0) {
      return res
        .status(404)
        .json({ message: "No channels or videos found for that query" });
    }

    // 5) Success payload
    return res.json({
      channel: channel || null,
      channelVideos, // [] if no channel
      videos, // could be []
    });
  } catch (err) {
    console.error("searchAll error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
};
