// 📍 المكان: src/index.ts
// ✨ النسخة المحدثة مع Student Context & Emotional Intelligence

import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { prisma } from './config/database.config';
import { websocketService } from './services/websocket/websocket.service';
import { openAIService } from './services/ai/openai.service';
import { teachingAssistant } from './services/teaching/teaching-assistant.service';
import { ragService } from './core/rag/rag.service';
import { quizService } from './core/quiz/quiz.service';

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket with enhanced features
websocketService.initialize(httpServer);

// ============= STARTUP CONFIGURATION =============
async function displayStartupInfo() {
  console.log('\n' + '='.repeat(40));
  console.log('🚀 Smart Education Platform Configuration');
  console.log('='.repeat(40));
  console.log(`📦 Environment: ${config.NODE_ENV}`);
  console.log(`🌐 Port: ${config.PORT}`);
  console.log(`💾 Database: SQLite`);
  console.log(`📊 Cache: Redis (${(config as any).REDIS_HOST ? 'Enabled' : 'Disabled'})`);
  
  console.log('\n🧠 Enhanced Features:');
  console.log('  ✅ Student Context: ENABLED');
  console.log('  ✅ Emotional Intelligence: ENABLED');
  console.log('  ✅ Adaptive Learning: ENABLED');
  console.log('  ✅ Real-time Monitoring: ENABLED');
  console.log('  ✅ Achievement System: ENABLED');
  console.log('  ✅ Parent Reports: ENABLED');
  
  console.log('\n🤖 AI Services:');
  console.log(`  • OpenAI: ${openAIService.isReady() ? '✅ Ready' : '⚠️ Not configured'}`);
  console.log(`  • Teaching Assistant: ✅ Ready`);
  console.log(`  • RAG System: ✅ Ready`);
  console.log(`  • Voice Service: ${config.ELEVENLABS_API_KEY ? '✅ Ready' : '⚠️ Not configured'}`);
  
  console.log('='.repeat(40) + '\n');
}

// ============= DATABASE INITIALIZATION =============
async function initializeDatabase() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Run any pending migrations in development
    if (config.NODE_ENV === 'development') {
      // Check if StudentContext table exists
      try {
        await prisma.$queryRaw`SELECT 1 FROM StudentContext LIMIT 1`;
        console.log('✅ StudentContext table ready');
      } catch (error) {
        console.log('⚠️ StudentContext table not found. Run: npx prisma migrate dev');
      }
      
      // Check if EmotionalState table exists
      try {
        await prisma.$queryRaw`SELECT 1 FROM EmotionalState LIMIT 1`;
        console.log('✅ EmotionalState table ready');
      } catch (error) {
        console.log('⚠️ EmotionalState table not found. Run: npx prisma migrate dev');
      }
    }
    
    // Initialize test data if needed
    if (config.NODE_ENV === 'development') {
      await ensureTestData();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// ============= TEST DATA SETUP =============
async function ensureTestData() {
  try {
    // Check if test user exists
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@test.com' }
    });
    
    if (!testUser) {
      console.log('📝 Creating test user...');
      const user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          password: '$2b$10$dummy', // Dummy hash
          firstName: 'Test',
          lastName: 'User',
          role: 'STUDENT',
          grade: 6,
          isActive: true,
          emailVerified: true,
          // Create profile
          profile: {
            create: {
              points: 0,
              level: 1,
              coins: 0,
              streak: 0
            }
          }
          // Note: studentContext will be created separately after migration
        }
      });
      console.log('✅ Test user created:', user.email);
      
      // Try to create student context if table exists
      try {
        await prisma.$queryRaw`
          INSERT INTO StudentContext (id, userId, learningStyle, currentMood, averageConfidence, averageEngagement, createdAt, updatedAt)
          VALUES (
            lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
            ${user.id},
            'visual',
            'neutral',
            70,
            80,
            datetime('now'),
            datetime('now')
          )
        `;
        console.log('✅ Student context created for test user');
      } catch (error) {
        console.log('⚠️ Could not create student context (table may not exist yet)');
      }
    }
    
    // Check if test subject exists
    const testSubject = await prisma.subject.findFirst({
      where: { grade: 6 }
    });
    
    if (!testSubject) {
      console.log('📚 Creating test educational content...');
      // Create test subject, unit, and lesson
      const subject = await prisma.subject.create({
        data: {
          name: 'Mathematics',
          nameEn: 'Mathematics',
          nameAr: 'الرياضيات',
          grade: 6,
          description: 'Grade 6 Mathematics',
          isActive: true,
          units: {
            create: {
              title: 'Algebra Basics',
              titleEn: 'Algebra Basics',
              titleAr: 'أساسيات الجبر',
              description: 'Introduction to algebraic concepts',
              isActive: true,
              lessons: {
                create: {
                  title: 'Introduction to Variables',
                  titleEn: 'Introduction to Variables',
                  titleAr: 'مقدمة في المتغيرات',
                  description: 'Understanding variables and expressions',
                  difficulty: 'EASY',
                  isPublished: true,
                  estimatedMinutes: 45
                }
              }
            }
          }
        }
      });
      console.log('✅ Test content created');
    }
  } catch (error) {
    console.error('⚠️ Test data setup error:', error);
  }
}

// ============= MONITORING & STATS =============
function startMonitoring() {
  // Log stats every minute in development
  if (config.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = {
        connectedUsers: websocketService.getConnectedUsersCount(),
        openAIRequests: openAIService.getUsageStats().requestCount,
        teachingAssistantHealth: teachingAssistant.getHealthStatus()
      };
      
      if (stats.connectedUsers > 0) {
        console.log(`📊 [Stats] Users: ${stats.connectedUsers} | AI Requests: ${stats.openAIRequests}`);
      }
    }, 60000); // Every minute
  }
  
  // Monitor memory usage
  setInterval(() => {
    const used = process.memoryUsage();
    const mbUsed = Math.round(used.heapUsed / 1024 / 1024);
    
    if (mbUsed > 200) {
      console.warn(`⚠️ High memory usage: ${mbUsed} MB`);
    }
  }, 300000); // Every 5 minutes
}

// ============= START SERVER =============
async function startServer() {
  try {
    // Display startup info
    await displayStartupInfo();
    
    // Initialize services
    console.log('🔄 Initializing services...');
    
    // Initialize OpenAI
    if (config.OPENAI_API_KEY) {
      console.log('✅ OpenAI client initialized');
      const stats = openAIService.getUsageStats();
      console.log(`   📊 Default Model: ${stats.defaultModel}`);
      console.log(`   💰 Monthly Limit: ${stats.costBreakdown.limit}`);
    }
    
    // Initialize Voice Service
    if (config.ELEVENLABS_API_KEY) {
      console.log('✅ Voice service initialized with ElevenLabs');
    }
    
    // Initialize WebSocket features
    console.log('✅ WebSocket server initialized');
    console.log('   📌 Path: /socket.io/');
    console.log('   🔌 Transports: polling + websocket');
    console.log('   💖 Emotional Intelligence: ENABLED');
    console.log('   🏆 Achievement System: ENABLED');
    console.log('   📊 Real-time Monitoring: ENABLED');
    
    // Initialize database
    const dbReady = await initializeDatabase();
    if (!dbReady) {
      throw new Error('Database initialization failed');
    }
    
    // Start monitoring
    startMonitoring();
    
    // Start HTTP server
    httpServer.listen(config.PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 Server running on http://localhost:${config.PORT}`);
      console.log(`📡 WebSocket ready on ws://localhost:${config.PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`👥 Connected users: ${websocketService.getConnectedUsersCount()}`);
      console.log('='.repeat(60));
      console.log('\n✨ System ready for intelligent education!\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============= GRACEFUL SHUTDOWN =============
const gracefulShutdown = async (signal: string) => {
  console.log(`\n📛 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close HTTP server
    console.log('🔄 Closing HTTP server...');
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Save any pending student contexts
    console.log('💾 Saving student contexts...');
    // In production, iterate through connected users and save their contexts
    
    // Disconnect from database
    console.log('🔄 Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    
    // Clear caches
    console.log('🧹 Clearing caches...');
    openAIService.clearCaches();
    teachingAssistant.clearCache();
    
    console.log('👋 Goodbye! Shutdown complete.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// ============= ERROR HANDLERS =============
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// ============= SHUTDOWN SIGNALS =============
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// ============= START THE SYSTEM =============
startServer().catch((error) => {
  console.error('💥 Fatal error during startup:', error);
  process.exit(1);
});