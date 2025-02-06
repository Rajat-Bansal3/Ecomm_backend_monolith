import express from "express";
import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/order.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../types";

const router = express.Router();

router.use(protect);

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/:id/cancel", cancelOrder);

router.put("/:id/status", authorize(UserRole.ADMIN), updateOrderStatus);

export default router;
