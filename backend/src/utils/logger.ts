import winston from "winston";
import { productionConfig } from "../config/production";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || "development";
  return env === "production" ? "error" : "debug";
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const format =
  process.env.NODE_ENV === "production" ? productionFormat : developmentFormat;

const developmentTransports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
  }),
  new winston.transports.File({ filename: "logs/all.log" }),
];

const productionTransports = [
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    maxFiles: Number.parseInt(productionConfig.logging.maxFiles),
    maxsize: Number.parseInt(productionConfig.logging.maxSize),
    tailable: productionConfig.logging.tailable,
    zippedArchive: productionConfig.logging.zippedArchive,
  }),
  new winston.transports.File({
    filename: "logs/combined.log",
    maxFiles: Number.parseInt(productionConfig.logging.maxFiles),
    maxsize: Number.parseInt(productionConfig.logging.maxSize),
    tailable: productionConfig.logging.tailable,
    zippedArchive: productionConfig.logging.zippedArchive,
  }),
];

const transports =
  process.env.NODE_ENV === "production"
    ? productionTransports
    : developmentTransports;

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    ...transports,
  ],
  // Add these exception handlers
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({ filename: "logs/exceptions.log" }),
  ],
  // Add these rejection handlers
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({ filename: "logs/rejections.log" }),
  ],
  exitOnError: false, // Change this to false
});

// Add shutdown handler
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM. Performing graceful shutdown...");

  // Close all transports
  logger.clear();

  // Exit process
  process.exit(0);
});
