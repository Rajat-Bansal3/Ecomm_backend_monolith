import type { Request } from "express";
import type { Document } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  refreshToken?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes: string[];
  lastActive: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateMfaSecret(): Promise<string>;
  verifyMfaToken(token: string): Promise<boolean>;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category: string;
  createdBy: IUser["_id"];
  isActive: boolean;
}

export interface ICart extends Document {
  user: IUser["_id"];
  items: Array<{
    product: IProduct["_id"];
    quantity: number;
  }>;
  totalAmount: number;
}

export interface IOrder extends Document {
  user: IUser["_id"];
  items: Array<{
    product: IProduct["_id"];
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  paymentStatus: "pending" | "completed" | "failed";
}

export interface AuthRequest extends Request {
  user?: IUser;
}
export const batchesSchema = {
  PRODUCT_CHUNK: 200,
  ORDER_CHUNK: 100,
  USER_CHUNK: 100,
};
export type BATCHES = typeof batchesSchema;
