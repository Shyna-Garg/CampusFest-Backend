const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const asyncHandler = require("../utils/asynchandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

const TOKEN_LIFETIME_DAYS = 7;
const TOKEN_EXPIRATION = `${TOKEN_LIFETIME_DAYS}d`;
const TOKEN_COOKIE_MAX_AGE = TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

function tokenCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    };
}

function publicUser({ _id, username, email, role }) {
    return { _id, username, email, role };
}

const registerUser = asyncHandler(async (req, res) => {

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or:[
            {username},
            {email}
        ]
    })

    if(isUserAlreadyExists){
        return res.status(409).json({message:"User already exists"})
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await userModel.create({
        username,
        email,
        password:hash,
        role: "user"
    })
    const token = jwt.sign({
        id:user._id,
        role:user.role
    }, process.env.JWT_SECRET,
      {
        expiresIn: TOKEN_EXPIRATION,
      })
    res.cookie("token", token, {
      ...tokenCookieOptions(),
      maxAge: TOKEN_COOKIE_MAX_AGE,
  });

    return res.status(201).json(
        new ApiResponse(
            201,
            publicUser(user),
            "User registered successfully"
        )
    );
});

async function loginUser(req,res) {
    const{username, email, password} = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
    throw new ApiError(
        404,
        "User not found"
    );
}
    const isPasswordValid = await bcrypt.compare(password,user.password)
    if(!isPasswordValid){
        return res.status(401).json({message:"Invalid creds"})
    }
    const token = jwt.sign({
        id:user._id,
        role: user.role
    }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION })

    res.cookie("token", token, {
      ...tokenCookieOptions(),
      maxAge: TOKEN_COOKIE_MAX_AGE,
  });
    return res.status(200).json(
    new ApiResponse(
        200,
        publicUser(user),
        "Login successful"
    )
);
}

async function logoutUser(req,res) {
    res.clearCookie("token", tokenCookieOptions());
    res.status(200).json({message:"User logged out successfully "})
}

async function getProfile(req, res) {
  try {
    const user = await userModel
      .findById(req.user.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

const updateProfile = asyncHandler(async (req, res) => {
  const { username, email } = req.body;

  const user = await userModel.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (username) {
    user.username = username.trim();
  }

  if (email) {
    const existingUser = await userModel.findOne({
      email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      throw new ApiError(400, "Email already exists");
    }

    user.email = email.trim().toLowerCase();
  }

  await user.save();

  const updatedUser = await userModel
    .findById(user._id)
    .select("-password");

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedUser,
      "Profile updated successfully"
    )
  );
});

module.exports = {registerUser, loginUser, logoutUser, getProfile, updateProfile}