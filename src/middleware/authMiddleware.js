import jwt from "jsonwebtoken";
import User from "../models/User.js";
import config from "../config/config.js";

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in.",
            });
        }

        const accessToken = authHeader.split(" ")[1];

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Access token is missing.",
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(accessToken, config.JWT_SECRET);
        } catch {
            return res.status(401).json({
                success: false,
                message: "Access token is invalid or expired.",
            });
        }

        if (
            !decoded.userId ||
            typeof decoded.userId !== "string" ||
            decoded.type === "refresh"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid access token.",
            });
        }

        const user = await User.findById(decoded.userId).select("_id");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found.",
            });
        }

        req.user = {
            userId: user._id.toString(),
        };

        return next();
    } catch (error) {
        console.error("Authentication middleware error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Authentication failed.",
        });
    }
};

export default authMiddleware;