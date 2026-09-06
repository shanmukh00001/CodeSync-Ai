const mongoose = require("mongoose");

const discussionMessageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    clientMessageId: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for efficient room history queries sorted by time
discussionMessageSchema.index({ room: 1, createdAt: 1 });

// Scoped unique compound index for room + clientMessageId idempotency
discussionMessageSchema.index(
  { room: 1, clientMessageId: 1 },
  { unique: true }
);

const DiscussionMessage = mongoose.model(
  "DiscussionMessage",
  discussionMessageSchema
);

module.exports = DiscussionMessage;
