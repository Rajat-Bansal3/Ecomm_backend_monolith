import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { authenticator } from "otplib";
import { type IUser, UserRole } from "../types";

const userSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    mfaBackupCodes: [
      {
        type: String,
        select: false,
      },
    ],
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.password = undefined;
        ret.refreshToken = undefined;
        ret.mfaSecret = undefined;
        ret.mfaBackupCodes = undefined;
        return ret;
      },
    },
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// MFA methods
userSchema.methods.generateMfaSecret = async function (): Promise<string> {
  const secret = authenticator.generateSecret();
  this.mfaSecret = secret;
  this.mfaBackupCodes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substr(2, 8),
  );
  await this.save();
  return secret;
};

userSchema.methods.verifyMfaToken = function (token: string): boolean {
  if (!this.mfaSecret) return false;
  return authenticator.verify({ token, secret: this.mfaSecret });
};

// Update lastActive timestamp on document access
userSchema.pre(/^find/, function () {
  this.updateOne({}, { $set: { lastActive: new Date() } });
});

export const User = mongoose.model<IUser>("User", userSchema);
