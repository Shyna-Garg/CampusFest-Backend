const registrationModel = require("../models/registration.model");
const Event = require("../models/event.model");

async function registerEvent(req, res) {
  try {
    const { teamName, members } = req.body;

    const eventId = req.params.eventId;
    const userId = req.user.id;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const alreadyRegistered = await registrationModel.findOne({
      eventId,
      userId,
    });

    if (alreadyRegistered) {
      return res.status(409).json({
        success: false,
        message: "You have already registered for this event",
      });
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide team members",
      });
    }

    if (
      members.length < event.minTeamSize ||
      members.length > event.maxTeamSize
    ) {
      return res.status(400).json({
        success: false,
        message: `Team size should be between ${event.minTeamSize} and ${event.maxTeamSize}`,
      });
    }

    const registration = await registrationModel.create({
      eventId,
      userId,
      teamName,
      members,
    });

    return res.status(201).json({
      success: true,
      message: "Event registered successfully",
      data: registration,
    });

  } catch (err) {
    console.error("Registration Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getMyRegistrations(req, res) {
  try {
    const userId = req.user.id;

    const myRegistrations = await registrationModel
      .find({ userId })
      .populate(
        "eventId",
        "title venue date category bannerImage"
      );

    return res.status(200).json({
      success: true,
      message: "Registered events fetched successfully",
      count: myRegistrations.length,
      data: myRegistrations,
    });

  } catch (err) {
    console.error("Get Registrations Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
    });
  }
}

module.exports = {registerEvent,getMyRegistrations};