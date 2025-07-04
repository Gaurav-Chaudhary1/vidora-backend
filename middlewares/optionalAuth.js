const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.optionalAuth = async (req, _res, next) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (auth) {
    try {
      const payload = jwt.verify(auth, process.env.JWT_SECRET);
      req.user = await User.findById(payload.id);
    } catch (_err) {
      // ignore invalid token
      req.user = null;
    }
  }
  next();
};