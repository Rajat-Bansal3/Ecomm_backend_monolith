import type { Response } from "express";
import { redis } from "../config/database";
import { Cart } from "../models/cart.model";
import { Product } from "../models/product.model";
import type { AuthRequest } from "../types";
import { ApiResponse } from "../utils/response";
import { catchAsync } from "../utils/response";

const CACHE_TTL = 60 * 5; // 5 minutes

export const getCart = catchAsync(async (req: AuthRequest, res: Response) => {
  const cacheKey = `cart:${req.user?._id}`;

  const cachedCart = await redis.get(cacheKey);
  if (cachedCart) {
    return ApiResponse.success(res, JSON.parse(cachedCart));
  }

  const cart = await Cart.findOne({ user: req.user?._id }).populate({
    path: "items.product",
    select: "name price images stock",
  });

  if (!cart) {
    return ApiResponse.success(res, { items: [], totalAmount: 0 });
  }

  await redis.set(cacheKey, JSON.stringify(cart), "EX", CACHE_TTL);

  return ApiResponse.success(res, cart);
});

export const addToCart = catchAsync(async (req: AuthRequest, res: Response) => {
  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return ApiResponse.error(res, "Product not found", 404);
  }

  if (product.stock < quantity) {
    return ApiResponse.error(res, "Insufficient stock", 400);
  }

  let cart = await Cart.findOne({ user: req.user?._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user?._id,
      items: [{ product: productId, quantity }],
      totalAmount: product.price * quantity,
    });
  } else {
    const itemIndex = cart.items.findIndex(
      (item) => item.product?.toString() === productId,
    );

    if (itemIndex > -1) {
      const newQuantity = cart.items[itemIndex].quantity + quantity;
      if (product.stock < newQuantity) {
        return ApiResponse.error(res, "Insufficient stock", 400);
      }
      cart.items[itemIndex].quantity = newQuantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + product.price * item.quantity;
    }, 0);

    await cart.save();
  }

  await redis.del(`cart:${req.user?._id}`);

  return ApiResponse.success(res, cart, "Item added to cart successfully");
});

export const updateCartItem = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return ApiResponse.error(res, "Product not found", 404);
    }

    if (product.stock < quantity) {
      return ApiResponse.error(res, "Insufficient stock", 400);
    }

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      return ApiResponse.error(res, "Cart not found", 404);
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product?.toString() === productId,
    );

    if (itemIndex === -1) {
      return ApiResponse.error(res, "Item not found in cart", 404);
    }

    cart.items[itemIndex].quantity = quantity;

    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + product.price * item.quantity;
    }, 0);

    await cart.save();

    await redis.del(`cart:${req.user?._id}`);

    return ApiResponse.success(res, cart, "Cart updated successfully");
  },
);

export const removeFromCart = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      return ApiResponse.error(res, "Cart not found", 404);
    }

    cart.items = cart.items.filter(
      (item) => item.product?.toString() !== productId,
    );

    const product = await Product.findById(productId);
    if (product) {
      cart.totalAmount = cart.items.reduce((total, item) => {
        return total + product.price * item.quantity;
      }, 0);
    }

    await cart.save();

    await redis.del(`cart:${req.user?._id}`);

    return ApiResponse.success(
      res,
      cart,
      "Item removed from cart successfully",
    );
  },
);

export const clearCart = catchAsync(async (req: AuthRequest, res: Response) => {
  const cart = await Cart.findOne({ user: req.user?._id });
  if (!cart) {
    return ApiResponse.error(res, "Cart not found", 404);
  }

  cart.items = [];
  cart.totalAmount = 0;
  await cart.save();

  await redis.del(`cart:${req.user?._id}`);

  return ApiResponse.success(res, cart, "Cart cleared successfully");
});
