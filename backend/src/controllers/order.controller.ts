import type { Response } from "express";
import { redis } from "../config/database";
import { Cart } from "../models/cart.model";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import type { AuthRequest } from "../types";
import { ApiResponse } from "../utils/response";
import { catchAsync } from "../utils/response";

export const createOrder = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { shippingAddress } = req.body;

    const cart = await Cart.findOne({ user: req.user?._id }).populate({
      path: "items.product",
      select: "name price stock isActive",
    });
    if (!cart || cart.items.length === 0) {
      return ApiResponse.error(res, "Cart is empty", 400);
    }

    const orderItems = [];
    for (const item of cart.items) {
      const product = item.product as any;
      console.log(product);
      if (!product.isActive) {
        return ApiResponse.error(
          res,
          `Product ${product.name} is no longer available`,
          400,
        );
      }
      if (product.stock < item.quantity) {
        return ApiResponse.error(
          res,
          `Insufficient stock for ${product.name}`,
          400,
        );
      }

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });

      await Product.findByIdAndUpdate(product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    const order = await Order.create({
      user: req.user?._id,
      items: orderItems,
      totalAmount: cart.totalAmount,
      shippingAddress,
      status: "pending",
      paymentStatus: "pending",
    });

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    await Promise.all([
      redis.del(`cart:${req.user?._id}`),
      redis.del(`orders:${req.user?._id}`),
    ]);

    return ApiResponse.success(res, order, "Order created successfully", 201);
  },
);

export const getOrders = catchAsync(async (req: AuthRequest, res: Response) => {
  const page = Number.parseInt(req.query.page as string) || 1;
  const limit = Number.parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;

  const cacheKey = `orders:${req.user?._id}:${page}:${limit}:${status}`;

  const cachedOrders = await redis.get(cacheKey);
  if (cachedOrders) {
    return ApiResponse.success(res, JSON.parse(cachedOrders));
  }

  const query: any = { user: req.user?._id };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("items.product", "name images price"),
    Order.countDocuments(query),
  ]);

  const data = {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };

  await redis.set(cacheKey, JSON.stringify(data), "EX", 300);

  return ApiResponse.success(res, data);
});

export const getOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await Order.findOne({
    _id: id,
    user: req.user?._id,
  }).populate("items.product", "name images price");

  if (!order) {
    return ApiResponse.error(res, "Order not found", 404);
  }

  return ApiResponse.success(res, order);
});

export const updateOrderStatus = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    if (req.user?.role !== "admin") {
      return ApiResponse.error(
        res,
        "Not authorized to update order status",
        403,
      );
    }

    order.status = status;
    await order.save();

    await redis.del(`orders:${order.user}`);

    return ApiResponse.success(res, order, "Order status updated successfully");
  },
);

export const cancelOrder = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      user: req.user?._id,
    });

    if (!order) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    if (!["pending", "processing"].includes(order.status)) {
      return ApiResponse.error(res, "Order cannot be cancelled", 400);
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = "cancelled";
    await order.save();

    await redis.del(`orders:${req.user?._id}`);

    return ApiResponse.success(res, order, "Order cancelled successfully");
  },
);
