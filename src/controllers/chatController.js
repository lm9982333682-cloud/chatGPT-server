import { ChatGroq } from "@langchain/groq";

import Chat from "../models/Chat.js";
import config from "../config/config.js";

const getGroqModel = () => {
    if (!config.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing in the .env file");
    }

    return new ChatGroq({
        apiKey: config.GROQ_API_KEY,
        model: config.GROQ_MODEL,
        temperature: 0.7,
    });
};

// Create a new chat
export const createChat = async (req, res) => {
    try {
        const chat = await Chat.create({
            userId: req.user.userId,
            title: "New Chat",
            messages: [],
            isStarred: false,
        });

        return res.status(201).json({
            success: true,
            message: "Chat created successfully",
            chat,
        });
    } catch (error) {
        console.error("Create chat error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create chat",
        });
    }
};

// Send a message to Groq AI
export const sendMessage = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { message } = req.body;

        if (
            typeof message !== "string" ||
            !message.trim() ||
            message.length > 10000
        ) {
            return res.status(400).json({
                success: false,
                message: "Message must contain 1 to 10000 characters",
            });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            userId: req.user.userId,
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found",
            });
        }

        if (chat.messages.length >= 200) {
            return res.status(400).json({
                success: false,
                message: "This chat has reached its message limit",
            });
        }

        const conversationHistory = chat.messages
            .slice(-20)
            .map((item) => ({
                role: item.role === "assistant" ? "assistant" : "user",
                content: item.content,
            }));

        const model = getGroqModel();

        const response = await model.invoke([
            {
                role: "system",
                content:
                    "You are Nova AI, a helpful and accurate AI assistant. " +
                    "Respond clearly and adapt to the user's language.",
            },
            ...conversationHistory,
            {
                role: "user",
                content: message.trim(),
            },
        ]);

        const assistantMessage =
            typeof response.content === "string"
                ? response.content
                : JSON.stringify(response.content);

        chat.messages.push(
            {
                role: "user",
                content: message.trim(),
            },
            {
                role: "assistant",
                content: assistantMessage,
            }
        );

        if (chat.messages.length === 2 && chat.title === "New Chat") {
            const trimmedMessage = message.trim();

            chat.title =
                trimmedMessage.slice(0, 60) +
                (trimmedMessage.length > 60 ? "..." : "");
        }

        await chat.save();

        return res.status(200).json({
            success: true,
            message: "Response generated successfully",
            chatId: chat._id,
            title: chat.title,
            userMessage: chat.messages[chat.messages.length - 2],
            assistantMessage: chat.messages[chat.messages.length - 1],
        });
    } catch (error) {
        console.error("Send message error:", error.message);

        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to generate AI response",
        });
    }
};

// Get all chats belonging to the logged-in user
export const getAllChats = async (req, res) => {
    try {
        const chats = await Chat.find({
            userId: req.user.userId,
        })
            .select("title createdAt updatedAt messages isStarred")
            .sort({ updatedAt: -1 })
            .lean();

        const conversations = chats.map((chat) => {
            const lastMessage = chat.messages.at(-1);

            return {
                _id: chat._id,
                title: chat.title,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                isStarred: Boolean(chat.isStarred),
                lastMessage: lastMessage
                    ? {
                        role: lastMessage.role,
                        content: lastMessage.content,
                    }
                    : null,
                messageCount: chat.messages.length,
            };
        });

        return res.status(200).json({
            success: true,
            count: conversations.length,
            chats: conversations,
        });
    } catch (error) {
        console.error("Get chats error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve chats",
        });
    }
};

// Get one chat and its messages
export const getChatById = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findOne({
            _id: chatId,
            userId: req.user.userId,
        }).lean();

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found",
            });
        }

        return res.status(200).json({
            success: true,
            chat: {
                ...chat,
                isStarred: Boolean(chat.isStarred),
            },
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID",
            });
        }

        console.error("Get chat error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve chat",
        });
    }
};

// Toggle Star / Favourite status of a chat
export const toggleStarChat = async (req, res) => {
    try {
        const { chatId } = req.params;

        // A user can only update their own chat.
        const chat = await Chat.findOne({
            _id: chatId,
            userId: req.user.userId,
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found",
            });
        }

        chat.isStarred = !chat.isStarred;

        await chat.save();

        return res.status(200).json({
            success: true,
            message: chat.isStarred
                ? "Chat added to favourites"
                : "Chat removed from favourites",
            chat: {
                _id: chat._id,
                isStarred: chat.isStarred,
            },
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID",
            });
        }

        console.error("Toggle star chat error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update favourite status",
        });
    }
};

// Delete a chat owned by the logged-in user
export const deleteChat = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findOneAndDelete({
            _id: chatId,
            userId: req.user.userId,
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Chat deleted successfully",
            chatId: chat._id,
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID",
            });
        }

        console.error("Delete chat error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to delete chat",
        });
    }
};