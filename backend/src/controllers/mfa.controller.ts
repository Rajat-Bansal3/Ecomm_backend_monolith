import type { Response } from "express";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { User } from "../models/user.model";
import type { AuthRequest } from "../types";
import { ApiResponse } from "../utils/response";
import { catchAsync } from "../utils/response";

export const enableMfa = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?._id).select(
    "+mfaSecret +mfaBackupCodes",
  );
  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const secret = await user.generateMfaSecret();

  const otpauth = authenticator.keyuri(user.email, "Ecommerce App", secret);

  const qrCode = await QRCode.toDataURL(otpauth);

  return ApiResponse.success(res, {
    qrCode,
    backupCodes: user.mfaBackupCodes,
    message:
      "Scan the QR code with your authenticator app and verify with the generated token",
  });
});

export const verifyAndEnableMfa = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { token } = req.body;

    const user = await User.findById(req.user?._id).select("+mfaSecret");
    if (!user) {
      return ApiResponse.error(res, "User not found", 404);
    }

    const isValid = user.verifyMfaToken(token);
    if (!isValid) {
      return ApiResponse.error(res, "Invalid token", 400);
    }

    user.mfaEnabled = true;
    await user.save();

    return ApiResponse.success(res, {
      message: "MFA enabled successfully",
    });
  },
);

export const disableMfa = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { token, backupCode } = req.body;

    const user = await User.findById(req.user?._id).select(
      "+mfaSecret +mfaBackupCodes",
    );
    if (!user) {
      return ApiResponse.error(res, "User not found", 404);
    }

    const isValidToken = token && user.verifyMfaToken(token);
    const isValidBackupCode =
      backupCode && user.mfaBackupCodes.includes(backupCode);

    if (!isValidToken && !isValidBackupCode) {
      return ApiResponse.error(res, "Invalid token or backup code", 400);
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    await user.save();

    return ApiResponse.success(res, {
      message: "MFA disabled successfully",
    });
  },
);

export const verifyMfa = catchAsync(async (req: AuthRequest, res: Response) => {
  const { token, backupCode } = req.body;
  const userId = req.user?._id;

  const user = await User.findById(userId).select("+mfaSecret +mfaBackupCodes");
  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const isValidToken = token && user.verifyMfaToken(token);
  const isValidBackupCode =
    backupCode && user.mfaBackupCodes.includes(backupCode);

  if (!isValidToken && !isValidBackupCode) {
    return ApiResponse.error(res, "Invalid token or backup code", 400);
  }

  if (isValidBackupCode) {
    user.mfaBackupCodes = user.mfaBackupCodes.filter(
      (code) => code !== backupCode,
    );
    await user.save();
  }

  return ApiResponse.success(res, {
    message: "MFA verification successful",
  });
});
