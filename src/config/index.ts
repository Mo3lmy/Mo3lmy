import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define environment schema
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  // Database
  DATABASE_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Redis
  REDIS_URL: z.string().optional(),
  
  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  
  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().optional(),
});

// Validate and export config
const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(envParsed.error.format());
  process.exit(1);
}

export const config = envParsed.data;

// Export typed config for better IntelliSense
export type Config = typeof config;

console.log('✅ Configuration loaded successfully');