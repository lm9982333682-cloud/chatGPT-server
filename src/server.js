import app from "./app.js";
import connectDB from "./config/db.js";
import config from "./config/config.js";

const startServer = async () => {
    try {
        if (!config.JWT_SECRET || !config.JWT_REFRESH_SECRET) {
            throw new Error("JWT secrets are missing in the .env file");
        }

        await connectDB();

        const server = app.listen(config.PORT, () => {
            console.log(
                `Nova AI Chat server running on port ${config.PORT}`
            );
        });

        const shutdown = (signal) => {
            console.log(`${signal} received. Shutting down server...`);

            server.close(async () => {
                try {
                    const mongoose = await import("mongoose");

                    await mongoose.default.connection.close();

                    console.log("MongoDB connection closed");
                    process.exit(0);
                } catch (error) {
                    console.error("Shutdown error:", error.message);
                    process.exit(1);
                }
            });
        };

        process.once("SIGINT", () => shutdown("SIGINT"));
        process.once("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();