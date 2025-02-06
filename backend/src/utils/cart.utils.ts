import { redis } from "../config/database";
import { Cart } from "../models/cart.model";
import { logger } from "../utils/logger";

const CART_INACTIVITY_TIMEOUT = 30 * 60; // 30 minutes

export const getCartFromCache = async (userId: string) => {
  const cacheKey = `cart:${userId}`;
  const cachedCart = await redis.get(cacheKey);
  return cachedCart ? JSON.parse(cachedCart) : null;
};

export const setCartToCache = async (userId: string, cart: any) => {
  const cacheKey = `cart:${userId}`;
  await redis.set(
    cacheKey,
    JSON.stringify(cart),
    "EX",
    CART_INACTIVITY_TIMEOUT,
  );
};

export const syncCartToDb = async (userId: string) => {
  try {
    const cachedCart = await getCartFromCache(userId);
    if (cachedCart) {
      await Cart.findOneAndUpdate(
        { user: userId },
        {
          items: cachedCart.items,
          totalAmount: cachedCart.totalAmount,
        },
        { new: true, upsert: true },
      );
      await redis.del(`cart:${userId}`);
      logger.info(`Cart synced to DB for user: ${userId}`);
    }
  } catch (error) {
    logger.error(`Error syncing cart to DB for user: ${userId}`, error);
  }
};

export const loadCartFromDb = async (userId: string) => {
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    select: "name price images stock",
  });

  if (cart) {
    await setCartToCache(userId, cart);
    logger.info(`Cart loaded from DB to cache for user: ${userId}`);
  }

  return cart;
};

// Function to get cart with fallback to DB
export const getCart = async (userId: string) => {
  let cart = await getCartFromCache(userId);

  if (!cart) {
    cart = await loadCartFromDb(userId);
  }

  return cart || { items: [], totalAmount: 0 };
};

// Function to handle cart updates
export const updateCart = async (userId: string, cart: any) => {
  await setCartToCache(userId, cart);

  // Schedule DB sync after inactivity
  const syncTimeout = setTimeout(() => {
    syncCartToDb(userId);
  }, CART_INACTIVITY_TIMEOUT * 1000);

  // Clear previous timeout if exists
  const previousTimeout = cartSyncTimeouts.get(userId);
  if (previousTimeout) {
    clearTimeout(previousTimeout);
  }

  cartSyncTimeouts.set(userId, syncTimeout);
};

// Map to store sync timeouts
const cartSyncTimeouts = new Map();
