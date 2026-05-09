import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET is not configured" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
    const userId = payload.userId ?? payload.sub;
    if (!userId) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    req.user = { id: userId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
