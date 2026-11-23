const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    venue: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    capacity: {
      type: Number,
      default: null
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Technical",
        "Cultural",
        "Sports",
        "Workshop",
        "Seminar",
        "Hackathon",
        "Other",
      ],
    },

    bannerImage: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Upcoming",
        "Ongoing",
        "Completed",
        "Cancelled",
      ],
      default: "Upcoming",
    },

    minTeamSize: {
      type: Number,
      default: 1,
      min: 1,
    },

    maxTeamSize: {
      type: Number,
      default: 1,
      min: 1,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;