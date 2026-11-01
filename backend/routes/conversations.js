const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");

/**
 * POST /api/conversations
 * Start a new conversation record for a (browser-scoped, anonymous) session
 */
router.post("/", async (req, res) => {
  try {
    const { anonId, roomName } = req.body;

    if (!anonId) {
      return res.status(400).json({
        success: false,
        error: "anonId is required",
      });
    }

    const conversation = await Conversation.create({
      anonId,
      roomName: roomName || "",
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error("Error creating conversation:", error.message);
    res.status(500).json({ success: false, error: "Failed to create conversation" });
  }
});

/**
 * GET /api/conversations?anonId=xxx
 * List conversation summaries for a given browser-scoped anonId, newest first
 */
router.get("/", async (req, res) => {
  try {
    const { anonId } = req.query;

    if (!anonId) {
      return res.status(400).json({
        success: false,
        error: "anonId query parameter is required",
      });
    }

    const conversations = await Conversation.find({ anonId })
      .sort({ startedAt: -1 })
      .select("roomName status startedAt endedAt bookingId transcript")
      .lean();

    const summaries = conversations.map((c) => {
      const lastEntry = c.transcript[c.transcript.length - 1];
      return {
        _id: c._id,
        status: c.status,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        hasBooking: !!c.bookingId,
        messageCount: c.transcript.length,
        preview: lastEntry ? lastEntry.text : "",
      };
    });

    res.json({ success: true, data: summaries });
  } catch (error) {
    console.error("Error listing conversations:", error.message);
    res.status(500).json({ success: false, error: "Failed to list conversations" });
  }
});

/**
 * GET /api/conversations/:id
 * Get one full conversation, including its transcript
 */
router.get("/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }
    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error("Error fetching conversation:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch conversation" });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update a conversation's transcript/status/bookingId (called as the chat
 * progresses, and once more on disconnect to mark it ended)
 */
router.patch("/:id", async (req, res) => {
  try {
    const { transcript, status, bookingId } = req.body;
    const update = {};

    if (transcript) update.transcript = transcript;
    if (bookingId) update.bookingId = bookingId;
    if (status) {
      update.status = status;
      if (status === "ended") update.endedAt = new Date();
    }

    const conversation = await Conversation.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error("Error updating conversation:", error.message);
    res.status(500).json({ success: false, error: "Failed to update conversation" });
  }
});

module.exports = router;
