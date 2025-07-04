const { Router } = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const protect = require("../middlewares/auth");
const sendMail = require("../utils/sendEmail");
const upload = require("../middlewares/upload");
const { uploadFileToB2 } = require("../config/backblaze");

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "secretname";

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
};

// GET /api/me protected route
router.get("/me", protect, (req, res) => {
  res.status(200).json({ user: req.user });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }
    res.status(200).json({
      token: generateToken(user),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        channelId: user.channelId,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong!", error: error.message });
  }
});

// POST /api/signup (multipart/form-data)
router.post("/signup", upload.single("profileImage"), async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists!" });
    }
    // If profile image provided, upload to B2
    let profilePictureUrl = "";
    if (req.file) {
      const folder = `profile_pictures/${email}`;
      const fileName = `${folder}/${Date.now()}-${req.file.originalname}`;
      const url = await uploadFileToB2(
        fileName,
        req.file.buffer,
        req.file.mimetype
      );
      profilePictureUrl = url;
    }
    // Create user with profilePictureUrl
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      profilePictureUrl,
    });
    res.status(201).json({
      token: generateToken(user),
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        channelId: user.channelId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed!", error: error.message });
  }
});

// Reset Password Request
router.post("/reset-request", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found!" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 Minutes

    user.resetCode = resetCode;
    user.resetCodeExpiry = expiry;
    await user.save();

    await sendMail(
      email,
      "Password Reset Code",
      `Your password reset code is: ${resetCode}`
    );

    res.status(201).json({ message: "Reset code sent successfully!" });
  } catch (error) {
    res
      .status(401)
      .json({ message: "Some error occured: ", error: error.message });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found!" });

    if (
      !user.resetCode ||
      user.resetCode != code ||
      user.resetCodeExpiry < Date.now()
    ) {
      return res.status(401).json({ message: "Invalid or expired code" });
    }

    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    res
      .status(200)
      .json({ message: "Password has been changed successfully!" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Some error occured: ", error: err.message });
  }
});

module.exports = router;
