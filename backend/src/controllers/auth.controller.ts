import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { redis } from "../config/database";
import { User } from "../models/user.model";
import { UserRole } from "../types";
import { ApiResponse } from "../utils/response";
import { catchAsync } from "../utils/response";

const generateTokens = (userId: string) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT secret keys in environment variables.");
  }

  const accessToken = jwt.sign(
    { id: userId } as JwtPayload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshToken = jwt.sign(
    { id: userId } as JwtPayload,
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    },
  );

  return { accessToken, refreshToken };
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return ApiResponse.error(res, "Email already registered", 400);
  }

  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    role: UserRole.USER,
  });

  const { accessToken, refreshToken } = generateTokens(String(user._id));

  user.refreshToken = refreshToken;
  await user.save();

  return ApiResponse.success(res, {
    user: {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return ApiResponse.error(res, "Invalid credentials", 401);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return ApiResponse.error(res, "Invalid credentials", 401);
  }

  if (!user.isActive) {
    return ApiResponse.error(res, "Account is deactivated", 401);
  }

  const { accessToken, refreshToken } = generateTokens(String(user._id));

  user.refreshToken = refreshToken;
  await user.save();

  return ApiResponse.success(res, {
    user: {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return ApiResponse.error(res, "Refresh token is required", 400);
  }

  const decoded = jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET as string,
  ) as jwt.JwtPayload;

  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== refreshToken) {
    return ApiResponse.error(res, "Invalid refresh token", 401);
  }

  const tokens = generateTokens(String(user._id));

  user.refreshToken = tokens.refreshToken;
  await user.save();

  return ApiResponse.success(res, tokens);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const refreshToken = req.body.refreshToken;

  if (token) {
    await redis.set(
      `bl_${token}`,
      "true",
      "EX",
      60 * 60, // 1 hour
    );
  }

  if (refreshToken) {
    await User.findOneAndUpdate(
      { refreshToken },
      { $set: { refreshToken: null } },
    );
  }

  return ApiResponse.success(res, null, "Logged out successfully");
});
