import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define environment schema with OpenAI configs
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
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_MAX_TOKENS: z.string().default('1000'),
  OPENAI_TEMPERATURE: z.string().default('0.7'),
  OPENAI_MONTHLY_LIMIT: z.string().default('10'),
  
  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().optional(),
  
  // Cache Settings
  CACHE_TTL: z.string().default('3600'),
  USE_CACHE: z.string().default('true'),
  
  // Debug
  DEBUG_AI: z.string().default('false'),
  MOCK_MODE: z.string().default('false'),
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

// Log configuration status
if (config.OPENAI_API_KEY) {
  console.log('✅ OpenAI API configured with model:', config.OPENAI_MODEL);
} else {
  console.log('⚠️ OpenAI API key not found - running in mock mode');
}