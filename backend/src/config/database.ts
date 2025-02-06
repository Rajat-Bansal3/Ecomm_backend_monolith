import Redis from "ioredis";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import { productionConfig } from "./production";

// MongoDB Connection
export const connectDB = async (): Promise<void> => {
  try {
    const options =
      process.env.NODE_ENV === "production"
        ? productionConfig.mongooseOptions
        : {};

    const conn = await mongoose.connect(
      process.env.MONGODB_URI as string,
      options,
    );
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle MongoDB connection errors
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      try {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed through app termination");
        process.exit(0);
      } catch (err) {
        logger.error("Error during MongoDB connection closure:", err);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

// Redis Connection
const redisOptions =
  process.env.NODE_ENV === "production"
    ? {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        ...productionConfig.redisOptions,
      }
    : {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      };

export const redis = new Redis(redisOptions);

// Redis event handlers
redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (error) => {
  logger.error("Redis connection error:", error);
});

redis.on("ready", () => {
  logger.info("Redis client ready");
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

redis.on("reconnecting", () => {
  logger.info("Redis client reconnecting");
});

// Graceful shutdown handler for Redis
process.on("SIGTERM", async () => {
  try {
    await redis.quit();
    logger.info("Redis connection closed through app termination");
    process.exit(0);
  } catch (err) {
    logger.error("Error during Redis connection closure:", err);
    process.exit(1);
  }
});
