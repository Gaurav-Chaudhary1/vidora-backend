// controllers/fileController.js
const { getSecureDownloadLink } = require("../config/b2Utils");

exports.getSignedUrl = async (req, res) => {
  // 1️⃣ Pull fileUrl from the JSON body instead of req.query
  const { fileUrl } = req.body;
  if (!fileUrl) {
    return res
      .status(400)
      .json({ message: "Missing fileUrl in request body" });
  }

  try {
    // 2️⃣ Generate the signed URL
    const signedUrl = await getSecureDownloadLink(fileUrl);
    return res.json({ signedUrl });
  } catch (err) {
    console.error("Error generating signed URL", err);
    return res
      .status(500)
      .json({ message: "Failed to generate signed URL", error: err.message });
  }
};
