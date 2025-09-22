import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { AppError, handleError } from './utils/errors';
import { websocketService } from './services/websocket/websocket.service';
import path from 'path';

// Import existing routes
import authRoutes from './api/rest/auth.routes';
import contentRoutes from './api/rest/content.routes';
import chatRoutes from './api/rest/chat.routes';
import quizRoutes from './api/rest/quiz.routes';

// Import new v1 routes
import curriculumRoutesV1 from './api/v1/curriculum';
import quizRoutesV1 from './api/v1/quiz';
import studentRoutesV1 from './api/v1/student';

// // Import Orchestrator routes (NEW)
// import orchestratorRoutes from './api/rest/orchestrator.routes';

// Create Express app
const app: Application = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // للسماح بـ WebSocket
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

// Aggressive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // غيّرناها من 5 إلى 50 للتطوير
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true, // مهم: لا يحسب المحاولات الناجحة
});

app.use('/api/', limiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '2.0.0', // Updated version
    services: {
      websocket: {
        connected: websocketService.getConnectedUsersCount(),
        status: 'active'
      },
      orchestrator: 'active', // NEW
      database: 'connected',
      ai: 'ready'
    }
  });
});

// API Status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    services: {
      database: 'connected',
      cache: 'connected',
      ai: 'ready',
      rag: 'ready',
      websocket: 'active',
      orchestrator: 'active', // NEW
      slideGenerator: 'ready', // NEW
      realtimeChat: 'active' // NEW
    },
    timestamp: new Date().toISOString(),
  });
});

// ============= ENHANCED WEBSOCKET TEST PAGE WITH SLIDES =============
app.get('/test-websocket', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>WebSocket & Slides Test</title>
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Tajawal', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .main-container {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 350px 1fr;
            gap: 20px;
        }
        
        /* Control Panel */
        .control-panel {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            height: fit-content;
        }
        
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 20px;
            font-size: 24px;
        }
        
        .status {
            padding: 12px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
            border-radius: 8px;
            font-size: 14px;
        }
        
        .connected { 
            background: #d4edda; 
            color: #155724;
            border: 2px solid #c3e6cb;
        }
        
        .disconnected { 
            background: #f8d7da; 
            color: #721c24;
            border: 2px solid #f5c6cb;
        }
        
        .button-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        button {
            padding: 10px 20px;
            cursor: pointer;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        button:hover { 
            background: #5a67d8;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        button:disabled { 
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .theme-selector {
            margin: 15px 0;
        }
        
        .theme-selector label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        
        .theme-selector select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        #logs {
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            padding: 10px;
            height: 250px;
            overflow-y: auto;
            font-family: 'Consolas', monospace;
            font-size: 12px;
            border-radius: 8px;
            margin-top: 15px;
        }
        
        .log-entry {
            margin-bottom: 3px;
            padding: 3px 5px;
            border-radius: 3px;
        }
        
        .log-success { background: #d4edda; color: #155724; }
        .log-error { background: #f8d7da; color: #721c24; }
        .log-info { background: #e7f3ff; color: #004085; }
        .log-warning { background: #fff3cd; color: #856404; }
        
        /* Slide Viewer */
        .slide-viewer {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .slide-header {
            background: #333;
            color: white;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .slide-info {
            font-size: 14px;
        }
        
        .slide-nav {
            display: flex;
            gap: 10px;
        }
        
        .nav-btn {
            padding: 5px 15px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .nav-btn:hover {
            background: #5a67d8;
        }
        
        .nav-btn:disabled {
            background: #666;
            cursor: not-allowed;
        }
        
        #slideContainer {
            height: 600px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background: #f8f9fa;
        }
        
        /* Slide Styles (from CSS file) */
        .slide-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px;
            color: white;
            font-family: 'Tajawal', sans-serif;
            direction: rtl;
            position: relative;
            overflow: hidden;
        }
        
        .slide-content {
            max-width: 900px;
            width: 100%;
            text-align: center;
        }
        
        .slide-title {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 2rem;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
        }
        
        .slide-subtitle {
            font-size: 2rem;
            font-weight: 400;
            opacity: 0.95;
        }
        
        .slide-heading {
            font-size: 2.5rem;
            margin-bottom: 2rem;
        }
        
        .slide-text {
            font-size: 1.5rem;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .slide-bullets {
            list-style: none;
            text-align: right;
            font-size: 1.4rem;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .slide-bullets li {
            margin: 1.5rem 0;
            padding-right: 2rem;
            position: relative;
        }
        
        .bullet-icon {
            position: absolute;
            right: 0;
            font-size: 1.2rem;
        }
        
        .quiz-option {
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            padding: 1.2rem;
            margin: 0.8rem;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 10px;
            color: white;
            font-size: 1.3rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .quiz-option:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        
        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
        }
        
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-slide-up { animation: slideUp 0.8s ease-out; }
        .animate-slide-in { animation: slideIn 0.6s ease-out backwards; }
        .animate-scale-in { animation: scaleIn 0.5s ease-out backwards; }
    </style>
</head>
<body>
    <div class="main-container">
        <!-- Control Panel -->
        <div class="control-panel">
            <h1>🔌 اختبار WebSocket + Slides</h1>
            
            <div id="status" class="status disconnected">غير متصل</div>
            
            <div class="button-group">
                <button onclick="connect()" id="connectBtn">اتصال</button>
                <button onclick="disconnect()">قطع الاتصال</button>
                <button onclick="testPing()" id="pingBtn" disabled>Ping Test</button>
            </div>
            
            <div class="theme-selector">
                <label>Theme:</label>
                <select id="themeSelect">
                    <option value="default">Default (Purple)</option>
                    <option value="blue">Blue Ocean</option>
                    <option value="green">Green Nature</option>
                    <option value="dark">Dark Mode</option>
                    <option value="colorful">Colorful</option>
                </select>
            </div>
            
            <div class="button-group">
                <button onclick="requestTitleSlide()" disabled id="titleBtn">Title Slide</button>
                <button onclick="requestContentSlide()" disabled id="contentBtn">Content Slide</button>
                <button onclick="requestBulletSlide()" disabled id="bulletBtn">Bullet Slide</button>
                <button onclick="requestQuizSlide()" disabled id="quizBtn">Quiz Slide</button>
                <button onclick="requestSummarySlide()" disabled id="summaryBtn">Summary Slide</button>
            </div>
            
            <div id="logs"></div>
        </div>
        
        <!-- Slide Viewer -->
        <div class="slide-viewer">
            <div class="slide-header">
                <div class="slide-info">
                    <span>Slide <span id="currentSlide">0</span> / <span id="totalSlides">0</span></span>
                </div>
                <div class="slide-nav">
                    <button class="nav-btn" onclick="navigateSlide('previous')">السابق</button>
                    <button class="nav-btn" onclick="navigateSlide('next')">التالي</button>
                </div>
            </div>
            <div id="slideContainer">
                <h2 style="color: #999;">سيظهر المحتوى هنا بعد الاتصال</h2>
            </div>
        </div>
    </div>
    
    <script>
        let socket = null;
        let token = null;
        let slideNumber = 0;
        let slides = [];
        
        function log(msg, type = 'info') {
            const logs = document.getElementById('logs');
            const time = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.className = 'log-entry log-' + type;
            entry.textContent = '[' + time + '] ' + msg;
            logs.appendChild(entry);
            logs.scrollTop = logs.scrollHeight;
        }
        
        async function connect() {
            const btn = document.getElementById('connectBtn');
            btn.disabled = true;
            
            try {
                log('🔐 جاري تسجيل الدخول...', 'info');
                
                const res = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'student1@test.com',
                        password: 'Test@1234'
                    })
                });
                
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.message || 'فشل تسجيل الدخول');
                }
                
                token = data.data.token;
                log('✅ تم تسجيل الدخول', 'success');
                
                log('🔌 جاري الاتصال...', 'info');
                
                socket = io({
                    auth: { token },
                    transports: ['polling', 'websocket']
                });
                
                socket.on('connect', () => {
                    log('✅ متصل! ID: ' + socket.id, 'success');
                    document.getElementById('status').className = 'status connected';
                    document.getElementById('status').textContent = 'متصل';
                    
                    // Enable buttons
                    document.getElementById('pingBtn').disabled = false;
                    document.getElementById('titleBtn').disabled = false;
                    document.getElementById('contentBtn').disabled = false;
                    document.getElementById('bulletBtn').disabled = false;
                    document.getElementById('quizBtn').disabled = false;
                    document.getElementById('summaryBtn').disabled = false;
                    
                    btn.disabled = false;
                });
                
                socket.on('welcome', (data) => {
                    log('👋 ' + data.message, 'success');
                });
                
                socket.on('slide_ready', (data) => {
                    log('🖼️ Slide received!', 'success');
                    displaySlide(data.html);
                    slides[data.slideNumber] = data.html;
                    updateSlideInfo(data.slideNumber);
                });
                
                socket.on('slide_error', (data) => {
                    log('❌ Slide error: ' + data.message, 'error');
                });
                
                socket.on('disconnect', (reason) => {
                    log('❌ انقطع الاتصال: ' + reason, 'error');
                    document.getElementById('status').className = 'status disconnected';
                    document.getElementById('status').textContent = 'غير متصل';
                    disableAllButtons();
                });
                
                socket.on('connect_error', (error) => {
                    log('❌ خطأ: ' + error.message, 'error');
                    btn.disabled = false;
                });
                
                socket.on('pong', () => {
                    log('🏓 Pong!', 'success');
                });
                
            } catch (error) {
                log('❌ خطأ: ' + error.message, 'error');
                btn.disabled = false;
            }
        }
        
        function disconnect() {
            if (socket) {
                socket.disconnect();
                socket = null;
                log('👋 تم قطع الاتصال', 'info');
                disableAllButtons();
            }
        }
        
        function testPing() {
            if (socket && socket.connected) {
                socket.emit('ping');
                log('🏓 Ping...', 'info');
            }
        }
        
        function requestTitleSlide() {
            const theme = document.getElementById('themeSelect').value;
            socket.emit('request_slide', {
                slideNumber: ++slideNumber,
                type: 'title',
                content: {
                    title: 'مرحباً في منصة التعليم الذكية',
                    subtitle: 'تعلم بطريقة تفاعلية وممتعة'
                },
                theme
            });
            log('📤 Requesting title slide...', 'info');
        }
        
        function requestContentSlide() {
            const theme = document.getElementById('themeSelect').value;
            socket.emit('request_slide', {
                slideNumber: ++slideNumber,
                type: 'content',
                content: {
                    title: 'ما هي الأعداد الطبيعية؟',
                    text: 'الأعداد الطبيعية هي الأعداد التي نستخدمها للعد، وتبدأ من الرقم 1 وتستمر إلى ما لا نهاية. مثل: 1، 2، 3، 4، 5...'
                },
                theme
            });
            log('📤 Requesting content slide...', 'info');
        }
        
        function requestBulletSlide() {
            const theme = document.getElementById('themeSelect').value;
            socket.emit('request_slide', {
                slideNumber: ++slideNumber,
                type: 'bullet',
                content: {
                    title: 'خصائص الأعداد الطبيعية',
                    bullets: [
                        'تبدأ من العدد 1',
                        'لا تحتوي على كسور أو أعداد عشرية',
                        'تستمر إلى ما لا نهاية',
                        'تُستخدم في العد والترتيب'
                    ]
                },
                theme
            });
            log('📤 Requesting bullet slide...', 'info');
        }
        
        function requestQuizSlide() {
            const theme = document.getElementById('themeSelect').value;
            socket.emit('request_slide', {
                slideNumber: ++slideNumber,
                type: 'quiz',
                content: {
                    quiz: {
                        question: 'أي من التالي يُعتبر عدد طبيعي؟',
                        options: ['0.5', '-3', '7', '2.5'],
                        correctIndex: 2
                    }
                },
                theme
            });
            log('📤 Requesting quiz slide...', 'info');
        }
        
        function requestSummarySlide() {
            const theme = document.getElementById('themeSelect').value;
            socket.emit('request_slide', {
                slideNumber: ++slideNumber,
                type: 'summary',
                content: {
                    bullets: [
                        'تعلمنا تعريف الأعداد الطبيعية',
                        'عرفنا خصائصها المميزة',
                        'تدربنا على التمييز بينها وبين الأعداد الأخرى',
                        'الأعداد الطبيعية أساس الرياضيات'
                    ]
                },
                theme
            });
            log('📤 Requesting summary slide...', 'info');
        }
        
        function displaySlide(html) {
            document.getElementById('slideContainer').innerHTML = html;
        }
        
        function updateSlideInfo(num) {
            document.getElementById('currentSlide').textContent = num;
            document.getElementById('totalSlides').textContent = slides.length;
        }
        
        function navigateSlide(direction) {
            // Simple navigation (would be connected to socket in real app)
            if (direction === 'next' && slideNumber < slides.length - 1) {
                slideNumber++;
            } else if (direction === 'previous' && slideNumber > 0) {
                slideNumber--;
            }
            
            if (slides[slideNumber]) {
                displaySlide(slides[slideNumber]);
                updateSlideInfo(slideNumber);
            }
        }
        
        function disableAllButtons() {
            document.getElementById('pingBtn').disabled = true;
            document.getElementById('titleBtn').disabled = true;
            document.getElementById('contentBtn').disabled = true;
            document.getElementById('bulletBtn').disabled = true;
            document.getElementById('quizBtn').disabled = true;
            document.getElementById('summaryBtn').disabled = true;
        }
        
        // Initialize
        window.onload = () => {
            log('🚀 جاهز للاختبار', 'info');
            log('💡 اضغط "اتصال" للبدء', 'info');
        };
    </script>
</body>
</html>
  `);
});

// ============= API ROUTES =============

// Existing REST routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/quiz', quizRoutes);

// New RAG and Progress routes
app.use('/api/v1/curriculum', curriculumRoutesV1);
app.use('/api/v1/quiz', quizRoutesV1); // This extends the existing quiz routes
app.use('/api/v1/student', studentRoutesV1);

// // Orchestrator routes (NEW)
// app.use('/api/v1/orchestrator', orchestratorRoutes);

// API Documentation endpoint (UPDATED)
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Smart Education Platform API',
    version: '2.0.0', // Updated version
    endpoints: {
      auth: {
        base: '/api/v1/auth',
        routes: [
          'POST /register',
          'POST /login',
          'GET /me',
          'POST /change-password',
          'POST /verify',
        ]
      },
      content: {
        base: '/api/v1/content',
        routes: [
          'GET /subjects',
          'GET /subjects/:id/units',
          'GET /units/:id/lessons',
          'GET /lessons/:id',
          'GET /lessons/:id/questions',
          'GET /search',
        ]
      },
      curriculum: {
        base: '/api/v1/curriculum',
        routes: [
          'POST /search',
          'POST /ask',
          'GET /suggest',
          'GET /trending',
          'POST /explain/concept',
          'POST /explain/formula',
          'POST /insights',
          'POST /adaptive',
          'GET /simplify/:text',
        ]
      },
      quiz: {
        base: '/api/v1/quiz',
        routes: [
          'POST /start',
          'POST /answer',
          'POST /complete/:attemptId',
          'GET /history',
          'GET /statistics/:lessonId',
          'POST /generate',
          'POST /generate/adaptive',
          'POST /regenerate',
          'GET /templates',
        ]
      },
      student: {
        base: '/api/v1/student',
        routes: [
          'GET /progress',
          'POST /progress/update',
          'GET /progress/subject/:subjectId',
          'GET /progress/statistics',
          'GET /progress/achievements',
          'GET /progress/leaderboard',
          'GET /progress/learning-path',
          'GET /gamification/stats',
          'GET /gamification/challenges',
          'POST /gamification/challenges/:challengeId/complete',
          'GET /gamification/rewards',
          'POST /gamification/rewards/:rewardId/claim',
        ]
      },
      chat: {
        base: '/api/v1/chat',
        routes: [
          'POST /message',
          'GET /history',
          'GET /session/:sessionId/summary',
          'POST /feedback',
          'GET /suggestions',
        ]
      },
      orchestrator: { // NEW section
        base: '/api/v1/orchestrator',
        routes: [
          'GET /lessons/:lessonId/flow',
          'POST /lessons/:lessonId/action',
          'GET /lessons/:lessonId/structure',
          'POST /lessons/:lessonId/navigate',
          'GET /lessons/:lessonId/progress',
        ]
      },
      websocket: { // UPDATED with new events
        base: 'ws://localhost:3000',
        events: {
          core: [
            'connect',
            'disconnect',
            'welcome',
            'ping/pong',
            'get_status'
          ],
          lessons: [
            'join_lesson',
            'leave_lesson',
            'joined_lesson',
            'user_joined_lesson',
            'user_left_lesson'
          ],
          slides: [
            'request_slide',
            'slide_ready',
            'slide_error',
            'navigate_slide',
            'navigation_complete',
            'update_slide',
            'slide_updated',
            'user_slide_change'
          ],
          orchestrator: [ // NEW category
            'start_orchestrated_lesson',
            'lesson_flow_started',
            'navigate_smart',
            'section_changed',
            'chat_with_action',
            'action_detected',
            'action_triggered',
            'request_action',
            'action_completed',
            'get_lesson_structure',
            'lesson_structure',
            'generate_smart_slide',
            'smart_slide_ready',
            'slide_generated',
            'get_flow_state',
            'flow_state',
            'update_comprehension',
            'comprehension_updated',
            'track_interaction',
            'get_lesson_progress',
            'lesson_progress',
            'control_flow',
            'flow_control_updated',
            'lesson_completed'
          ],
          chat: [
            'send_message',
            'new_message',
            'chat_message',
            'ai_response',
            'ai_typing',
            'stream_start',
            'stream_chunk',
            'stream_end',
            'get_chat_history',
            'chat_history',
            'rate_message',
            'rating_saved',
            'clear_chat',
            'chat_cleared'
          ],
          session: [
            'save_preferences',
            'preferences_saved',
            'session_restored',
            'session_ended'
          ]
        }
      }
    }
  });
});

// Test pages directory listing (NEW)
app.get('/test', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>صفحات الاختبار</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 90%;
        }
        h1 {
            color: #667eea;
            text-align: center;
            margin-bottom: 30px;
        }
        .test-links {
            display: grid;
            gap: 15px;
        }
        .test-link {
            display: block;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            text-decoration: none;
            color: #333;
            transition: all 0.3s;
            border: 2px solid transparent;
        }
        .test-link:hover {
            background: #667eea;
            color: white;
            transform: translateX(-10px);
            border-color: #667eea;
        }
        .test-link h3 {
            margin: 0 0 10px 0;
        }
        .test-link p {
            margin: 0;
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 صفحات الاختبار</h1>
        <div class="test-links">
            <a href="/test-websocket" class="test-link">
                <h3>🔌 WebSocket & Slides</h3>
                <p>اختبار الاتصال وتوليد الشرائح</p>
            </a>
            <a href="/test-orchestrator.html" class="test-link">
                <h3>🎯 Orchestrator System</h3>
                <p>النظام التفاعلي الذكي الكامل</p>
            </a>
            <a href="/test-chat.html" class="test-link">
                <h3>💬 Real-time Chat</h3>
                <p>المحادثة الذكية مع AI</p>
            </a>
            <a href="/test-full.html" class="test-link">
                <h3>🚀 Full System Test</h3>
                <p>اختبار شامل لكل المكونات</p>
            </a>
        </div>
    </div>
</body>
</html>
  `);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
      availableEndpoints: '/api',
      testPages: '/test', // NEW
    },
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const { statusCode, message, isOperational } = handleError(error);
  
  // Log error
  if (!isOperational) {
    console.error('ERROR:', error);
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: error instanceof AppError ? error.constructor.name : 'INTERNAL_ERROR',
      message,
      ...(config.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error 
      }),
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;