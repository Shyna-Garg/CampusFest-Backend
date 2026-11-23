const express = require("express");
const eventController = require("../controller/event.controller")
const auth = require("../middlewares/auth.middleware");
const adminRoleCheck = require("../middlewares/admin.middleware");

const router = express.Router();

router.post("/", auth.auth , adminRoleCheck.adminRoleCheck, eventController.createEvent);

router.get("/", eventController.getAllEvents)

router.get("/:id", eventController.getEventById);

router.put("/:id",auth.auth ,adminRoleCheck.adminRoleCheck ,eventController.updateEvent);

router.delete("/:id",auth.auth, adminRoleCheck.adminRoleCheck,eventController.deleteEvent)

module.exports = router;