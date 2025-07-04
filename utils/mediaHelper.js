// /utils/mediaHelper.js
const ffmpeg      = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;
const os          = require('os');
const path        = require('path');
const fs          = require('fs');

ffmpeg.setFfprobePath(ffprobePath);

/**
 * Write a buffer to a temp file then run ffprobe to get video duration
 * @param {Buffer} buffer 
 * @param {string} filename 
 * @returns {Promise<number>} duration in seconds
 */
async function getVideoDuration(buffer, filename) {
  const tempPath = path.join(os.tmpdir(), filename);
  await fs.promises.writeFile(tempPath, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(tempPath, (err, metadata) => {
      // clean up
      fs.unlink(tempPath, () => {});
      if (err) return reject(err);
      resolve(Math.round(metadata.format.duration || 0));
    });
  });
}

module.exports = { getVideoDuration };
