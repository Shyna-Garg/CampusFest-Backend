const express = require("express")
const authController = require("../controller/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")

const router = express.Router()

router.post("/register", authController.registerUser)
router.post("/login", authController.loginUser)
router.post("/logout", authController.logoutUser)
router.get("/profile", authMiddleware.auth ,authController.getProfile)
router.put("/profile", authMiddleware.auth, authController.updateProfile);

module.exports = router