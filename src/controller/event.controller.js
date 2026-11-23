const eventModel = require("../models/event.model");

async function createEvent(req, res) {
  try {
    const {
      title,
      description,
      date,
      venue,
      price,
      category,
      bannerImage,
      minTeamSize,
      maxTeamSize,
      capacity,
    } = req.body;

    if (!title || !venue || !date || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (minTeamSize > maxTeamSize) {
      return res.status(400).json({
        success: false,
        message: "Minimum team size cannot be greater than maximum team size",
      });
    }

    const eventDate = new Date(date);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (eventDate < today) {
      return res.status(400).json({
        success: false,
        message: "Event date cannot be in the past",
      });
    }

    const event = await eventModel.create({
      title,
      description,
      date,
      venue,
      price,
      category,
      bannerImage,
      minTeamSize,
      maxTeamSize,
      capacity,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event,
    });
  } catch (err) {
    console.error("Create Event Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getAllEvents(req, res) {
  try {
    const events = await eventModel
      .find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      message: "Events fetched successfully",
      data: events,
    });

  } catch (err) {
    console.log("getAllEvents error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
}

async function getEventById(req, res) {
  try {
    const eventId = req.params.id;
    const event = await eventModel.findById(eventId).populate("createdBy");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No event found with the given id",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event fetched successfully",
      data: event,
    });

  } catch (err) {
    console.log("getEventById error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch event",
    });
  }
}

async function updateEvent(req, res) {
  try {
    const eventId = req.params.id;
    const updateData = req.body;

    if (
      updateData.minTeamSize &&
      updateData.maxTeamSize &&
      updateData.minTeamSize > updateData.maxTeamSize
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum team size cannot be greater than maximum team size",
      });
    }

    if (updateData.date) {
      const eventDate = new Date(updateData.date);
      const today = new Date();

      today.setHours(0, 0, 0, 0);

      if (eventDate < today) {
        return res.status(400).json({
          success: false,
          message: "Event date cannot be in the past",
        });
      }
    }

    const updatedEvent = await eventModel.findByIdAndUpdate(
      eventId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: "No event found with the given id",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (err) {
    console.log("updateEvent error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
}

async function deleteEvent(req,res){
  try{
    const eventId = req.params.id
    const deletedEvent = await eventModel.findByIdAndDelete(eventId)
    if(!deletedEvent){
      return res.status(404).json({message:"No such event with id"})
    }
    return res.status(200).json({
      success:true,
      message:"Event deleted successfully"
})
}catch(err){
  return res.status(500).json({
      success: false,
      message: "Failed to delete event",
    });
}
}

module.exports = {createEvent,getAllEvents, getEventById, updateEvent, deleteEvent}
