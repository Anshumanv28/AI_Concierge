const mongoose = require("mongoose");

const transcriptEntrySchema = new mongoose.Schema(
  {
    speaker: {
      type: String,
      enum: ["user", "agent"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  // Anonymous, browser-scoped identifier (no login system exists) - set by the
  // frontend and stored in localStorage, so history is private to the browser
  // it was created in without requiring an accounts system.
  anonId: {
    type: String,
    required: true,
    index: true,
  },
  roomName: {
    type: String,
    default: "",
  },
  transcript: {
    type: [transcriptEntrySchema],
    default: [],
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
  },
  status: {
    type: String,
    enum: ["active", "ended"],
    default: "active",
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model("Conversation", conversationSchema);
