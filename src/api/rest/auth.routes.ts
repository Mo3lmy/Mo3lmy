import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.config';
import { authenticate } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../../utils/response.utils';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.enum(['STUDENT', 'TEACHER', 'PARENT', 'ADMIN']).optional(),
  grade: z.number().min(1).max(12).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const validationResult = registerSchema.safeParse(req.body);

  if (!validationResult.success) {
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
    );
    return;
  }

  const { email, password, firstName, lastName, role = 'STUDENT', grade } = validationResult.data;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    res.status(409).json(
      errorResponse('USER_EXISTS', 'البريد الإلكتروني مسجل بالفعل')
    );
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role as any,
      grade,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      grade: true,
      createdAt: true
    }
  });

  // Generate token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  res.status(201).json(
    successResponse({
      user,
      token
    }, 'تم التسجيل بنجاح')
  );
}));

// Login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const validationResult = loginSchema.safeParse(req.body);

  if (!validationResult.success) {
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'بيانات غير صحيحة', validationResult.error.issues)
    );
    return;
  }

  const { email, password } = validationResult.data;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !user.isActive) {
    res.status(401).json(
      errorResponse('INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    );
    return;
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    res.status(401).json(
      errorResponse('INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    );
    return;
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  // Generate token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, grade: user.grade },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  res.json(
    successResponse({
      user: userWithoutPassword,
      token
    }, 'تم تسجيل الدخول بنجاح')
  );
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      grade: true,
      isActive: true,
      createdAt: true,
      lastLogin: true
    }
  });

  if (!user) {
    res.status(404).json(
      errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
    );
    return;
  }

  res.json(
    successResponse({ user }, 'User data retrieved')
  );
}));

// Update profile
router.put('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { firstName, lastName, grade } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(grade && { grade })
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      grade: true
    }
  });

  res.json(
    successResponse({ user: updatedUser }, 'تم تحديث الملف الشخصي بنجاح')
  );
}));

// Change password
router.post('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'كلمة المرور الحالية والجديدة مطلوبة')
    );
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    res.status(404).json(
      errorResponse('USER_NOT_FOUND', 'المستخدم غير موجود')
    );
    return;
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);

  if (!isValidPassword) {
    res.status(401).json(
      errorResponse('INVALID_PASSWORD', 'كلمة المرور الحالية غير صحيحة')
    );
    return;
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  res.json(
    successResponse({}, 'تم تغيير كلمة المرور بنجاح')
  );
}));

// Logout (optional - mainly for client-side token removal)
router.post('/logout', authenticate, (req: Request, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  // This endpoint can be used for logging or cleanup if needed

  res.json(
    successResponse({}, 'تم تسجيل الخروج بنجاح')
  );
});

export default router;