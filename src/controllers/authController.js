import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";

import User from "../models/User.js";
import config from "../config/config.js";

const hashToken = (token) => {
    return createHash("sha256").update(token).digest("hex");
};

const generateAccessToken = (userId) => {
    return jwt.sign(
        { userId: userId.toString() },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN || "15m" }
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId: userId.toString(), type: "refresh" },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN || "7d" }
    );
};

const setRefreshCookie = (res, token) => {
    res.cookie("refreshToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/api/auth",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};


const clearRefreshCookie = (res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth",
    });
};

const saveRefreshToken = async (user, token) => {
    user.refreshToken = hashToken(token);
    user.refreshTokenExpiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    await user.save();
};

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required",
            });
        }

        if (name.trim().length < 2 || name.trim().length > 50) {
            return res.status(400).json({
                success: false,
                message: "Name must contain 2 to 50 characters",
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain 8 to 72 characters",
            });
        }

        if (Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                success: false,
                message: "Password is too long",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password,
        });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        await saveRefreshToken(user, refreshToken);

        setRefreshCookie(res, refreshToken);

        return res.status(201).json({
            success: true,
            message: "Registration successfully",
            accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to register user",
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        await saveRefreshToken(user, refreshToken);

        setRefreshCookie(res, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to login",
        });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is missing. Please log in again.",
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
        } catch {
            clearRefreshCookie(res);

            return res.status(401).json({
                success: false,
                message: "Refresh token is invalid or expired",
            });
        }

        if (decoded.type !== "refresh") {
            clearRefreshCookie(res);

            return res.status(401).json({
                success: false,
                message: "Invalid refresh token",
            });
        }

        const user = await User.findById(decoded.userId).select(
            "+refreshToken +refreshTokenExpiresAt"
        );

        if (
            !user ||
            !user.refreshToken ||
            !user.refreshTokenExpiresAt ||
            user.refreshTokenExpiresAt <= new Date() ||
            user.refreshToken !== hashToken(token)
        ) {
            clearRefreshCookie(res);

            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
            });
        }

        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        await saveRefreshToken(user, newRefreshToken);

        setRefreshCookie(res, newRefreshToken);

        return res.status(200).json({
            success: true,
            message: "Access token refreshed",
            accessToken: newAccessToken,
        });
    } catch (error) {
        console.error("Token refresh error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to refresh token",
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error("Get current user error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to get user profile",
        });
    }
};

export const logoutUser = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;

        if (token) {
            try {
                const decoded = jwt.verify(
                    token,
                    config.JWT_REFRESH_SECRET
                );

                if (decoded.type === "refresh") {
                    const user = await User.findById(
                        decoded.userId
                    ).select("+refreshToken");

                    if (
                        user &&
                        user.refreshToken === hashToken(token)
                    ) {
                        user.refreshToken = null;
                        user.refreshTokenExpiresAt = null;

                        await user.save();
                    }
                }
            } catch {
                // Invalid or expired tokens cannot be used to renew a session.
            }
        }

        clearRefreshCookie(res);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        console.error("Logout error:", error.message);

        clearRefreshCookie(res);

        return res.status(500).json({
            success: false,
            message: "Unable to logout",
        });
    }
};