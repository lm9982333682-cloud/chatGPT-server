import { Router } from "express";

import {
    registerUser,
    loginUser,
    refreshAccessToken,
    getMe,
    logoutUser,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Register a new user
router.post("/register", registerUser);

// Login an existing user
router.post("/login", loginUser);

// Generate a new access token using the refresh cookie
router.post("/refresh", refreshAccessToken);

// Get the currently authenticated user's profile
router.get("/me", authMiddleware, getMe);

// Logout the current session
router.post("/logout", logoutUser);

export default router;