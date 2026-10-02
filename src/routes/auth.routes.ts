import { Router, Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import { generateToken, authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

export const authRoutes = Router();

/**
 * POST /api/v1/auth/login
 */
authRoutes.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      sendError(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
      return;
    }

    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
      return;
    }

    if (!user.isActive) {
      sendError(res, 'User account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
      return;
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    sendSuccess(res, 'Authentication successful', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'AUTH_ERROR');
  }
});

/**
 * GET /api/v1/auth/me
 */
authRoutes.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    sendSuccess(res, 'Current user profile retrieved', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'PROFILE_ERROR');
  }
});

export default authRoutes;
