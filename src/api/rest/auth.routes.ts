import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../../core/auth/auth.service';
import { validateBody } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase, one lowercase, and one number'
  ),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  grade: z.number().min(1).max(12).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase, one lowercase, and one number'
  ),
});

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    
    res.status(201).json(
      successResponse(
        {
          user: result.user,
          token: result.token,
        },
        'Registration successful'
      )
    );
  })
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    
    res.json(
      successResponse(
        {
          user: result.user,
          token: result.token,
        },
        'Login successful'
      )
    );
  })
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getUserById(req.user!.userId);
    
    if (!user) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'User not found')
      );
      return;
    }
    
    res.json(
      successResponse(user, 'User retrieved successfully')
    );
  })
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(
      req.user!.userId,
      req.body.oldPassword,
      req.body.newPassword
    );
    
    res.json(
      successResponse(null, 'Password changed successfully')
    );
  })
);

/**
 * @route   POST /api/v1/auth/verify
 * @desc    Verify token
 * @access  Public
 */
router.post(
  '/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.body.token;
    
    if (!token) {
      res.status(400).json(
        errorResponse('INVALID_TOKEN', 'Token is required')
      );
      return;
    }
    
    const decoded = await authService.verifyToken(token);
    
    res.json(
      successResponse(
        { valid: true, userId: decoded.userId },
        'Token is valid'
      )
    );
  })
);

export default router;