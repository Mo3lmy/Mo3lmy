// 📍 المكان: src/index.ts

import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { prisma } from './config/database.config';
import { websocketService } from './services/websocket/websocket.service';

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket
websocketService.initialize(httpServer);

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Start server
    httpServer.listen(config.PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 Server running on http://localhost:${config.PORT}`);
      console.log(`📡 WebSocket ready on ws://localhost:${config.PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`👥 Connected users: ${websocketService.getConnectedUsersCount()}`);
      console.log('='.repeat(60) + '\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n📛 Shutting down gracefully...');
  
  httpServer.close(() => {
    console.log('💤 HTTP server closed');
  });
  
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
  
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();