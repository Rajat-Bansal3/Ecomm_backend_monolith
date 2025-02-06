import type { NextFunction, Request, Response } from "express";

export class ApiResponse {
  constructor(
    public success: boolean,
    public message: string,
    public data?: any,
    public statusCode = 200,
  ) {}

  static success(
    res: Response,
    data: any,
    message = "Success",
    statusCode = 200,
  ) {
    return res
      .status(statusCode)
      .json(new ApiResponse(true, message, data, statusCode));
  }

  static error(
    res: Response,
    message = "Internal Server Error",
    statusCode = 500,
    error?: any,
  ) {
    return res
      .status(statusCode)
      .json(new ApiResponse(false, message, error, statusCode));
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
    public stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// eslint-disable-next-line ..typescript-eslint/ban-types
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV === "development") {
    return ApiResponse.error(res, err.message, err.statusCode, {
      error: err,
      stack: err.stack,
    });
  }

  if (err.isOperational) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  console.error("ERROR 💥", err);
  return ApiResponse.error(res, "Something went wrong", 500);
};
