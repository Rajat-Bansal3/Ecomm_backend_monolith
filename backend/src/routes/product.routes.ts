import express from "express";
import {
  crateProductsBulk,
  createProduct,
  deleteProduct,
  getFeaturedProducts,
  getProduct,
  getProductCategories,
  getProducts,
  getProductsInfo,
  updateProduct,
} from "../controllers/product.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../types";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/categories", getProductCategories);
router.get("/featured", getFeaturedProducts);
router.post("/info", getProductsInfo);
router.get("/:id", getProduct);

// Protected routes
router.use(protect);

// Admin only routes
router.post("/", authorize(UserRole.ADMIN), createProduct);
router.post("/bulk", authorize(UserRole.ADMIN), crateProductsBulk);
router.put("/:id", authorize(UserRole.ADMIN), updateProduct);
router.delete("/:id", authorize(UserRole.ADMIN), deleteProduct);

export default router;
