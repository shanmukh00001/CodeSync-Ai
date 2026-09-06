const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },

    roomName: {
        type: String,
        required: true,
        trim: true
    },

    createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
},
users: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
],

 language: {
    type: String,
    default: "cpp"
 },

  code: {
         type: String,
         default: ""
     },

  selectedProblem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem",
    default: null
  },

  status: {
    type: String,
    enum: ["ACTIVE", "CLOSED"],
    default: "ACTIVE",
    index: true,
  },

  endedAt: {
    type: Date,
    default: null,
    index: true,
  },

  emptySince: {
    type: Date,
    default: null,
    index: true
  }
});


const Room = mongoose.model("Room", roomSchema);

module.exports = Room;