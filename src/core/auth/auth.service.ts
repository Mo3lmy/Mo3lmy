import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { config } from '../../config';

import { 
  AuthenticationError, 
  ValidationError, 
  ConflictError 
} from '../../utils/errors';
import { Prisma } from '@prisma/client';
type User = Prisma.UserGetPayload<{}>;
type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  grade: z.number().optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Token payload type
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  grade?: number;
}

// Auth Service Class
export class AuthService {
  private readonly saltRounds = 10;
  
  /**
   * Register a new user
   */
  async register(data: z.infer<typeof registerSchema>): Promise<{
    user: Partial<User>;
    token: string;
  }> {
    // Validate input
    const validated = registerSchema.parse(data);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, this.saltRounds);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        ...validated,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        grade: true,
        createdAt: true,
      },
    });
    
    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.grade || undefined,
    });
    
    return { user, token };
  }
  
  /**
   * Login user
   */
  async login(data: z.infer<typeof loginSchema>): Promise<{
    user: Partial<User>;
    token: string;
  }> {
    // Validate input
    const validated = loginSchema.parse(data);
    console.log('🔍 Login attempt for:', validated.email);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      console.log('❌ User not found:', validated.email);
      throw new AuthenticationError('Invalid credentials');
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      isActive: user.isActive,
      emailVerified: user.emailVerified
    });

    // Check password
    const isValidPassword = await bcrypt.compare(validated.password, user.password);
    console.log('🔐 Password check:', {
      inputPassword: validated.password,
      passwordValid: isValidPassword,
      hashStart: user.password.substring(0, 30)
    });

    if (!isValidPassword) {
      console.log('❌ Password invalid for user:', validated.email);
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    
    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      grade: user.grade || undefined,
    });
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    
    return { 
      user: userWithoutPassword, 
      token 
    };
  }
  
  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
      
      // Check if user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true },
      });
      
      if (!user || !user.isActive) {
        throw new AuthenticationError('Invalid token');
      }
      
      return decoded;
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }
  
  /**
   * Generate JWT token
   */
  private generateToken(payload: TokenPayload): string {
  const expiresIn = config.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn']
  });
}
  
  /**
   * Change password
   */
  async changePassword(
    userId: string, 
    oldPassword: string, 
    newPassword: string
  ): Promise<void> {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid old password');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }
  
  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Partial<User> | null> {
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
        emailVerified: true,
        createdAt: true,
        lastLogin: true,
      },
    });
    
    return user;
  }
}

// Export singleton instance
export const authService = new AuthService();