import csrf from "csurf";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { productionConfig } from "../config/production";

export const securityMiddleware = [
  // Force HTTPS
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.secure && process.env.NODE_ENV === "production") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  },

  // Apply security headers using helmet
  helmet({
    hsts: productionConfig.security.headers.strictTransportSecurity,
    contentSecurityPolicy:
      productionConfig.security.headers.contentSecurityPolicy,
    xssFilter: true,
    noSniff: true,
    frameguard: {
      action: "deny",
    },
  }),

  // CSRF protection
  csrf({
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    },
  }),

  // Add CSRF token to response
  (req: Request, res: Response, next: NextFunction) => {
    res.cookie("XSRF-TOKEN", req.csrfToken(), {
      httpOnly: productionConfig.security.csrf.cookie.httpOnly,
      secure: productionConfig.security.csrf.cookie.secure,
      sameSite: productionConfig.security.csrf.cookie.sameSite as
        | "strict"
        | "lax"
        | "none",
    });
    next();
  },
];
