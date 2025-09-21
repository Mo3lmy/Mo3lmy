import { chatService } from './core/chat/chat.service';
import { authService } from './core/auth/auth.service';
import { prisma } from './config/database.config';

async function testChatSystem() {
  console.log('🧪 Testing AI Chat System...\n');
  console.log('📌 Note: Running in MOCK MODE (no API keys needed)\n');
  
  try {
    // Create or get test user
    let user;
    try {
      user = await authService.register({
        email: 'chat-test@example.com',
        password: 'Test@1234',
        firstName: 'محمد',
        lastName: 'أحمد',
        grade: 6,
      });
    } catch {
      // User exists, login instead
      user = await authService.login({
        email: 'chat-test@example.com',
        password: 'Test@1234',
      });
    }
    
    console.log(`👤 Using user: ${user.user.firstName} ${user.user.lastName}\n`);
    
    // Get a lesson for context
    const lesson = await prisma.lesson.findFirst({
      where: { isPublished: true },
    });
    
    console.log(`📚 Lesson context: ${lesson?.title || 'No lesson'}\n`);
    
    // Test 1: Greeting
    console.log('1️⃣ Testing greeting...');
    let response = await chatService.processMessage(user.user.id as string, {
      message: 'مرحبا',
      lessonId: lesson?.id,
    });
    console.log(`   Bot: ${response.message.substring(0, 100)}...`);
    console.log(`   Session ID: ${response.sessionId}\n`);
    
    const sessionId = response.sessionId;
    
    // Test 2: Ask a question
    console.log('2️⃣ Testing question...');
    response = await chatService.processMessage(user.user.id as string, {
      message: 'ما هي الأعداد الطبيعية؟',
      sessionId,
      lessonId: lesson?.id,
    });
    console.log(`   Bot: ${response.message.substring(0, 150)}...`);
    console.log(`   Intent: ${response.metadata.intent}`);
    console.log(`   Confidence: ${response.metadata.confidence || 'N/A'}\n`);
    
    // Test 3: Request explanation
    console.log('3️⃣ Testing explanation request...');
    response = await chatService.processMessage(user.user.id as string, {
      message: 'اشرح لي الضرب بطريقة بسيطة',
      sessionId,
    });
    console.log(`   Bot: ${response.message.substring(0, 150)}...`);
    console.log(`   Suggested actions: ${response.metadata.suggestedActions?.length || 0}\n`);
    
    // Test 4: Help request
    console.log('4️⃣ Testing help request...');
    response = await chatService.processMessage(user.user.id as string, {
      message: 'كيف يمكنك مساعدتي؟',
      sessionId,
    });
    console.log(`   Bot: ${response.message.substring(0, 150)}...`);
    console.log(`   Follow-up questions: ${response.followUp?.length || 0}\n`);
    
    // Test 5: General conversation
    console.log('5️⃣ Testing general conversation...');
    response = await chatService.processMessage(user.user.id as string, {
      message: 'الدرس صعب شوية',
      sessionId,
      lessonId: lesson?.id,
    });
    console.log(`   Bot: ${response.message.substring(0, 150)}...`);
    if (response.metadata.suggestedActions?.length) {
      console.log(`   Suggestions: ${response.metadata.suggestedActions.map(a => a.label).join(', ')}`);
    }
    console.log('');
    
    // Test 6: Get chat history
    console.log('6️⃣ Testing chat history...');
    const history = await chatService.getChatHistory(user.user.id as string, lesson?.id, 10);
    console.log(`   Messages in history: ${history.length}`);
    console.log(`   Last message: ${history[0]?.content.substring(0, 50)}...\n`);
    
    // Test 7: Get conversation summary
    console.log('7️⃣ Testing conversation summary...');
    const summary = await chatService.getConversationSummary(sessionId);
    if (summary) {
      console.log(`   Duration: ${summary.duration} seconds`);
      console.log(`   Messages: ${summary.messageCount}`);
      console.log(`   Topics discussed: ${summary.topics.length}`);
      console.log(`   Questions asked: ${summary.questionsAsked.length}\n`);
    }
    
    console.log('🎉 AI Chat system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await prisma.chatMessage.deleteMany({
      where: {
        user: {
          email: 'chat-test@example.com',
        },
      },
    });
    await prisma.$disconnect();
  }
}

// Run tests
testChatSystem().catch(console.error);