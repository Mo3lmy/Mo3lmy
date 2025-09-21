import app from './app';
import { config } from './config';
import { prisma } from './config/database.config';

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Start Express server
    const server = app.listen(config.PORT, () => {
      console.log(`
🚀 Server is running!
📡 Environment: ${config.NODE_ENV}
🔗 URL: http://localhost:${config.PORT}
📚 API: http://localhost:${config.PORT}/api/v1
❤️  Health: http://localhost:${config.PORT}/health
      `);
    });
    
    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\n📛 Shutting down gracefully...');
      
      server.close(() => {
        console.log('💤 HTTP server closed');
      });
      
      await prisma.$disconnect();
      console.log('🔌 Database disconnected');
      
      process.exit(0);
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();