const express = require("express");
const registrationController = require("../controller/registration.controller");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/:eventId", auth.auth,registrationController.registerEvent)

router.get("/my", auth.auth,registrationController.getMyRegistrations)

module.exports = router;