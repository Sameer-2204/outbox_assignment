import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

/**
 * Middleware to verify JWT token from Authorization header.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    (req as any).authUser = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }
}

/**
 * Get the authenticated user from the request.
 */
export function getAuthUser(req: Request): AuthUser {
  return (req as any).authUser as AuthUser;
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
}
