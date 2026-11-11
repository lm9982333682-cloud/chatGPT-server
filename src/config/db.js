import mongoose from "mongoose";
import config from "./config.js";

const connectDB = async () => {
    try {
        if (!config.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing in .env file");
        }

        const res = await mongoose.connect(config.MONGODB_URI);

        console.log("MongoDB connected successfully", res.connection.host);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exitCode = 1;
        throw error;
    }
};

export default connectDB;