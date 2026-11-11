import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
        },

        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50000,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const chatSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
            immutable: true,
        },

        title: {
            type: String,
            trim: true,
            maxlength: 200,
            default: "New Chat",
        },

        messages: {
            type: [messageSchema],
            default: [],
        },

        // Star / Favourite Chat
        isStarred: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

chatSchema.index({ userId: 1, updatedAt: -1 });

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;