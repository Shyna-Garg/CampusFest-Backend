
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

async function auth(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!Number.isFinite(decoded.exp) || !decoded.id) {
      throw new jwt.JsonWebTokenError(
        "A valid user ID and finite expiration are required"
      );
    }

    // Always verify the account against the current database state.
    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account not found. Please login again.",
      });
    }

    // Use the current database identity and role, not stale JWT claims.
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    // Database or unexpected errors must never grant access.
    return res.status(500).json({
      success: false,
      message: "Authentication could not be verified.",
    });
  }
}

module.exports = { auth };
