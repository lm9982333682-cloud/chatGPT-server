import { Router } from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
    createChat,
    sendMessage,
    getAllChats,
    getChatById,
    deleteChat,
    toggleStarChat,
} from "../controllers/chatController.js";

const router = Router();

// All chat routes require authentication
router.use(authMiddleware);

// Create a new chat
router.post("/", createChat);

// Get all chats belonging to the logged-in user
router.get("/", getAllChats);

// Send a message to an existing chat
router.post("/:chatId/messages", sendMessage);

// Toggle Star / Unstar status
router.patch("/:chatId/star", toggleStarChat);

// Get one chat with its messages
router.get("/:chatId", getChatById);

// Delete a chat belonging to the logged-in user
router.delete("/:chatId", deleteChat);

export default router;