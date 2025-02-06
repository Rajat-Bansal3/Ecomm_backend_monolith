import mongoose from "mongoose";
import type { ICart } from "../types";

const cartSchema = new mongoose.Schema<ICart>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookups
cartSchema.index({ user: 1 });
cartSchema.index({ "items.product": 1 });

// Middleware to populate product details when finding a cart
cartSchema.pre(/^find/, function (next) {
  (this as any).populate({
    path: "items.product",
    select: "name price images isActive stock",
  });
  next();
});

export const Cart = mongoose.model<ICart>("Cart", cartSchema);
