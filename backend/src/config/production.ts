import type { RedisOptions } from "ioredis";
import type { ConnectOptions } from "mongoose";
import type { BATCHES } from "../types";

export const productionConfig = {
  // MongoDB Configuration
  mongooseOptions: {
    autoIndex: false, // Don't build indexes in production
    maxPoolSize: 50, // Maintain up to 50 socket connections
    minPoolSize: 10, // Maintain at least 10 socket connections
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    heartbeatFrequencyMS: 10000, // Heartbeat to check connection every 10 seconds
    retryWrites: true,
    writeConcern: {
      w: "majority", // Wait for writes to be acknowledged by majority
    },
  } as ConnectOptions,

  // Redis Configuration
  redisOptions: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts
      }
      return Math.min(times * 200, 2000); // Exponential backoff
    },
    reconnectOnError(err: Error) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true; // Only reconnect on READONLY error
      }
      return false;
    },
  } as RedisOptions,

  // Cache Configuration
  cache: {
    product: {
      ttl: 3600, // 1 hour
      maxItems: 1000, // Max items to cache
    },
    category: {
      ttl: 7200, // 2 hours
      maxItems: 100,
    },
    cart: {
      ttl: 1800, // 30 minutes
      syncInterval: 900, // 15 minutes
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Security
  security: {
    bcryptRounds: 12,
    jwtAccessExpiry: "15m",
    jwtRefreshExpiry: "7d",
    corsOptions: {
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["X-Total-Count"],
      maxAge: 600,
    },
    headers: {
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
      xssProtection: "1; mode=block",
      noSniff: true,
      frameguard: {
        action: "deny",
      },
    },
    csrf: {
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      },
      tokenLength: 32,
    },
  },

  // Performance
  performance: {
    compression: {
      level: 6, // Compression level (0-9)
      threshold: 1024, // Only compress responses bigger than 1KB
    },
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
    },
  },

  // Logging
  logging: {
    level: "error",
    maxFiles: "30d", // Keep logs for 30 days
    maxSize: "100m", // 100MB max file size
    tailable: true,
    zippedArchive: true,
  },
  batches: {} as BATCHES,
};
