import compression from "compression";
import cors from "cors";
import express, { type Application } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "dotenv";
import { connectDB } from "./config/database";
import { productionConfig } from "./config/production";
import { logger } from "./utils/logger";
import { errorHandler } from "./utils/response";

// Routes
import authRoutes from "./routes/auth.routes";
import cartRoutes from "./routes/cart.routes";
import mfaRoutes from "./routes/mfa.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";

config();

const app: Application = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

connectDB();
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",
    dnsPrefetchControl: process.env.NODE_ENV === "production",
    frameguard: process.env.NODE_ENV === "production",
    hidePoweredBy: true,
    hsts: process.env.NODE_ENV === "production",
    ieNoOpen: process.env.NODE_ENV === "production",
    noSniff: process.env.NODE_ENV === "production",
    referrerPolicy: process.env.NODE_ENV === "production",
    xssFilter: process.env.NODE_ENV === "production",
  }),
);

const corsOptions =
  process.env.NODE_ENV === "production"
    ? productionConfig.security.corsOptions
    : { origin: process.env.CORS_ORIGIN, credentials: true };

app.use(cors(corsOptions));

// Compression
if (process.env.NODE_ENV === "production") {
  app.use(
    compression({
      level: productionConfig.performance.compression.level,
      threshold: productionConfig.performance.compression.threshold,
    }),
  );
}

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const limiter = rateLimit(
  process.env.NODE_ENV === "production"
    ? productionConfig.rateLimit
    : {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
);

app.use(limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/mfa", mfaRoutes);

app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(
    `Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated!");
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! Shutting down...");
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
