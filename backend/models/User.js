const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    activeRoom: {
        type: String,
        default: null
    },
    recentRooms: [
        {
            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Room"
            },
            joinedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    solvedProblems: [
        {
            problem: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Problem",
                required: true
            },
            solvedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    nameChanged: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);
// Even though we write:

// mongoose.model("User", userSchema);

// MongoDB/Mongoose will typically use a collection named:
module.exports = User;