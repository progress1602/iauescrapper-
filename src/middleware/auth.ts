import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, IUserDocument } from '../models/user.model';
import { env } from '../config/env';
import { sendError } from '../utils/response';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'student';
}

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
  tokenPayload?: AuthTokenPayload;
}

export function generateToken(user: { id: string; email: string; role: 'admin' | 'student' }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required. Missing or malformed Bearer token.', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(res, 'Invalid Authorization header token format.', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.isActive) {
      sendError(res, 'User session invalid or account inactive.', 401, 'UNAUTHORIZED');
      return;
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch {
    sendError(res, 'Session token expired or signature invalid.', 401, 'TOKEN_EXPIRED');
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    sendError(
      res,
      'Access denied. Administrator privileges are required to perform this action.',
      403,
      'FORBIDDEN'
    );
    return;
  }
  next();
}
