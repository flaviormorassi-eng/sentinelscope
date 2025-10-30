import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}

// Simplified auth for MVP - extract user ID from Authorization header
// In production, this should verify Firebase ID tokens with Firebase Admin SDK
export async function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // For MVP: Extract userId from a custom header (set by client)
    // In production: Use Firebase Admin SDK to verify the ID token
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID' });
    }

    req.userId = userId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      req.userId = userId;
    }
    next();
  } catch (error) {
    next();
  }
}
