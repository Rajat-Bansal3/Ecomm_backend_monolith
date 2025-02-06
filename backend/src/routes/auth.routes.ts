import express from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  logout,
  refreshToken,
  register,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many attempts from this IP, please try again after 15 minutes",
});

router.post("/register", register);
router.post("/login", authLimiter, login);
router.post("/refresh-token", refreshToken);

// Protected routes
router.post("/logout", protect, logout);

export default router;
