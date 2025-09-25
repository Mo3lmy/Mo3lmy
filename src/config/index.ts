import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// ============= ENHANCED CONFIG SCHEMA =============
const envSchema = z.object({
  // ============= App Configuration =============
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  API_VERSION: z.string().default('v1'),
  APP_NAME: z.string().default('Smart Education Platform'),
  
  // ============= Database =============
  DATABASE_URL: z.string(),
  
  // ============= Authentication =============
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.string().default('10').transform(Number),
  
  // ============= Redis Cache =============
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  CACHE_TTL: z.string().default('3600').transform(Number),
  USE_CACHE: z.string().default('true').transform(v => v === 'true'),
  
  // ============= 🆕 RAG Performance Settings =============
  // Search Configuration
  RAG_THRESHOLD: z.string().default('0.3').transform(Number),
  USE_BATCH_SEARCH: z.string().default('true').transform(v => v === 'true'),
  SEARCH_BATCH_SIZE: z.string().default('100').transform(Number),
  MAX_EMBEDDINGS_TO_LOAD: z.string().default('1000').transform(Number),
  MIN_SCORE_FOR_RELEVANCE: z.string().default('0.15').transform(Number),
  
  // Query Enhancement
  USE_QUERY_EXPANSION: z.string().default('true').transform(v => v === 'true'),
  USE_SMART_CONTEXT: z.string().default('true').transform(v => v === 'true'),
  USE_FALLBACK_SEARCH: z.string().default('true').transform(v => v === 'true'),
  
  // Cache Configuration
  USE_EMBEDDING_CACHE: z.string().default('true').transform(v => v === 'true'),
  CACHE_CONFIDENCE_THRESHOLD: z.string().default('40').transform(Number),
  MAX_CACHE_SIZE: z.string().default('200').transform(Number),
  QUERY_CACHE_SIZE: z.string().default('100').transform(Number),
  
  // Performance Monitoring
  LOG_PERFORMANCE: z.string().default('false').transform(v => v === 'true'),
  LOG_CACHE_STATS: z.string().default('false').transform(v => v === 'true'),
  ENABLE_METRICS: z.string().default('true').transform(v => v === 'true'),
  
  // ============= OpenAI Configuration =============
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_MAX_TOKENS: z.string().default('1000').transform(Number),
  OPENAI_TEMPERATURE: z.string().default('0.7').transform(Number),
  OPENAI_MONTHLY_LIMIT: z.string().default('10').transform(Number),
  OPENAI_RPM: z.string().default('60').transform(Number),
  OPENAI_TPM: z.string().default('90000').transform(Number),
  
  // 🆕 OpenAI Performance
  OPENAI_RETRY_COUNT: z.string().default('3').transform(Number),
  OPENAI_RETRY_DELAY: z.string().default('1000').transform(Number),
  OPENAI_TIMEOUT: z.string().default('30000').transform(Number),
  
  // ============= ElevenLabs =============
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().default('eleven_multilingual_v2'),
  ELEVENLABS_STABILITY: z.string().default('0.75').transform(Number),
  ELEVENLABS_SIMILARITY_BOOST: z.string().default('0.85').transform(Number),
  
  // ============= Video Generation =============
  VIDEO_QUALITY: z.string().default('high'),
  VIDEO_RESOLUTION: z.string().default('1920x1080'),
  VIDEO_FPS: z.string().default('30').transform(Number),
  VIDEO_BITRATE: z.string().default('4000k'),
  
  // ============= Debug Settings =============
  DEBUG_AI: z.string().default('false').transform(v => v === 'true'),
  DEBUG_VIDEO: z.string().default('false').transform(v => v === 'true'),
  DEBUG_RAG: z.string().default('false').transform(v => v === 'true'),
  MOCK_MODE: z.string().default('false').transform(v => v === 'true'),
  LOG_LEVEL: z.string().default('info'),
  
  // ============= 🆕 System Performance =============
  MEMORY_LIMIT: z.string().default('1024').transform(Number),
  CLEANUP_INTERVAL: z.string().default('1800000').transform(Number),
  AUTO_CLEANUP_THRESHOLD: z.string().default('80').transform(Number),
});

// ============= VALIDATE AND EXPORT CONFIG =============
const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(envParsed.error.format());
  process.exit(1);
}

export const config = envParsed.data;

// ============= EXPORT TYPED CONFIG =============
export type Config = typeof config;

// ============= 🆕 FEATURE FLAGS (Grouped for Easy Access) =============
export const features = {
  rag: {
    useCache: config.USE_CACHE,
    useSmartContext: config.USE_SMART_CONTEXT,
    useBatchSearch: config.USE_BATCH_SEARCH,
    useQueryExpansion: config.USE_QUERY_EXPANSION,
    useFallbackSearch: config.USE_FALLBACK_SEARCH,
    useEmbeddingCache: config.USE_EMBEDDING_CACHE,
  },
  monitoring: {
    logPerformance: config.LOG_PERFORMANCE,
    logCacheStats: config.LOG_CACHE_STATS,
    enableMetrics: config.ENABLE_METRICS,
  },
  debug: {
    ai: config.DEBUG_AI,
    video: config.DEBUG_VIDEO,
    rag: config.DEBUG_RAG,
    mockMode: config.MOCK_MODE,
  },
};

// ============= 🆕 PERFORMANCE SETTINGS (Grouped) =============
export const performance = {
  rag: {
    threshold: config.RAG_THRESHOLD,
    batchSize: config.SEARCH_BATCH_SIZE,
    maxEmbeddings: config.MAX_EMBEDDINGS_TO_LOAD,
    minScore: config.MIN_SCORE_FOR_RELEVANCE,
    cacheConfidenceThreshold: config.CACHE_CONFIDENCE_THRESHOLD,
    maxCacheSize: config.MAX_CACHE_SIZE,
  },
  openai: {
    retryCount: config.OPENAI_RETRY_COUNT,
    retryDelay: config.OPENAI_RETRY_DELAY,
    timeout: config.OPENAI_TIMEOUT,
  },
  system: {
    memoryLimit: config.MEMORY_LIMIT,
    cleanupInterval: config.CLEANUP_INTERVAL,
    autoCleanupThreshold: config.AUTO_CLEANUP_THRESHOLD,
  },
};

// ============= LOG CONFIGURATION STATUS =============
console.log('========================================');
console.log('🚀 Smart Education Platform Configuration');
console.log('========================================');

// Environment
console.log(`📦 Environment: ${config.NODE_ENV}`);
console.log(`🌐 Port: ${config.PORT}`);

// Database
console.log(`💾 Database: ${config.DATABASE_URL.includes('postgresql') ? 'PostgreSQL' : 'SQLite'}`);

// Cache
if (config.REDIS_URL) {
  console.log(`📊 Cache: Redis (${config.USE_CACHE ? 'Enabled' : 'Disabled'})`);
} else {
  console.log(`📊 Cache: Memory (${config.USE_CACHE ? 'Enabled' : 'Disabled'})`);
}

// RAG Features
console.log('\n🧠 RAG Performance Features:');
console.log(`  ✅ Smart Context: ${config.USE_SMART_CONTEXT ? 'ON' : 'OFF'}`);
console.log(`  ✅ Batch Search: ${config.USE_BATCH_SEARCH ? 'ON' : 'OFF'} (${config.SEARCH_BATCH_SIZE} per batch)`);
console.log(`  ✅ Query Expansion: ${config.USE_QUERY_EXPANSION ? 'ON' : 'OFF'}`);
console.log(`  ✅ Embedding Cache: ${config.USE_EMBEDDING_CACHE ? 'ON' : 'OFF'}`);
console.log(`  📈 Threshold: ${config.RAG_THRESHOLD}`);

// OpenAI
if (config.OPENAI_API_KEY) {
  console.log(`\n🤖 OpenAI: Configured (${config.OPENAI_MODEL})`);
  console.log(`  • Rate Limits: ${config.OPENAI_RPM} RPM, ${config.OPENAI_TPM} TPM`);
  console.log(`  • Retry: ${config.OPENAI_RETRY_COUNT}x with ${config.OPENAI_RETRY_DELAY}ms delay`);
} else {
  console.log('\n⚠️  OpenAI: Not configured (Mock Mode)');
}

// ElevenLabs
if (config.ELEVENLABS_API_KEY) {
  console.log(`🎙️  ElevenLabs: Configured`);
} else {
  console.log('⚠️  ElevenLabs: Not configured');
}

// Debug Mode
if (config.NODE_ENV === 'development') {
  console.log('\n🐛 Debug Settings:');
  console.log(`  • AI Debug: ${config.DEBUG_AI ? 'ON' : 'OFF'}`);
  console.log(`  • RAG Debug: ${config.DEBUG_RAG ? 'ON' : 'OFF'}`);
  console.log(`  • Performance Logging: ${config.LOG_PERFORMANCE ? 'ON' : 'OFF'}`);
}

console.log('========================================\n');

// ============= EXPORT FOR BACKWARDS COMPATIBILITY =============
export default config;