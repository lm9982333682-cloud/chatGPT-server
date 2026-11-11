import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import config from "./config/config.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

// Security headers
app.use(helmet());

// Allow requests from your frontend
app.use(
    cors({
        origin: [config.CLIENT_ORIGIN, "https://chat-gpt-client-9vx2-iota.vercel.app"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Parse JSON request bodies
app.use(express.json({ limit: "20kb" }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Read HTTP-only cookies
app.use(cookieParser());

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

// app.use("/api", apiLimiter);

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
// Health check
app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Nova AI Chat API is running",
        environment: config.NODE_ENV,
    });
});

// Handle unknown routes
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "API route not found",
    });
});

// Central error handler
app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

export default app;