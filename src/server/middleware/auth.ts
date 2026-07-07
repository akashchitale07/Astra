import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/security.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Unauthorized: Token has expired or is invalid" });
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
  };

  next();
}
