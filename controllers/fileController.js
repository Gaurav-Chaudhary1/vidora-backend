// controllers/fileController.js
const { getSecureDownloadLink } = require("../config/b2Utils");

exports.getSignedUrl = async (req, res) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).json({ message: "Missing fileUrl query parameter" });
  }
  try {
    const signedUrl = await getSecureDownloadLink(fileUrl);
    res.json({ signedUrl });
  } catch (err) {
    console.error("Error generating signed URL", err);
    res.status(500).json({ message: err.message });
  }
};
