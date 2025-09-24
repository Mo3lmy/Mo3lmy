// 📍 المكان: src/services/ai/openai.service.ts
// النسخة المُصلحة بالكامل مع معالجة أفضل لـ API key والأخطاء

import OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';
import { LRUCache } from 'lru-cache';
import { config } from '../../config';
import { z } from 'zod';
import { 
  getPrompt, 
  PromptContext,
  PromptType 
} from '../../utils/prompt-templates';

// ============= TYPES =============

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  tokens: number;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  functions?: OpenAI.Chat.ChatCompletionCreateParams.Function[];
  function_call?: 'auto' | 'none' | { name: string };
  stream?: boolean;
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  prompt?: string;
  model?: string; // إضافة خيار اختيار الموديل
}

export interface TemplateOptions extends CompletionOptions {
  context: PromptContext;
  promptType: PromptType;
}

export interface StreamOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

// ============= CONFIGURATION =============

const AI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  MONTHLY_LIMIT: parseFloat(process.env.OPENAI_MONTHLY_LIMIT || '10'),
  CACHE_TTL: parseInt(process.env.OPENAI_CACHE_TTL || '3600'),
  RETRY_COUNT: parseInt(process.env.OPENAI_RETRY_COUNT || '3'),
  RETRY_DELAY: parseInt(process.env.OPENAI_RETRY_DELAY || '1000'),
  USE_MOCK: process.env.MOCK_MODE === 'true' || !process.env.OPENAI_API_KEY,
};

// ============= ENHANCED SERVICE CLASS =============

export class OpenAIService {
  private client: OpenAI | null = null;
  private encoder: any;
  private totalCost: number = 0;
  private responseCache: LRUCache<string, any>;
  private embeddingCache: LRUCache<string, number[]>;
  private requestCount: number = 0;
  private lastRequestTime: Date = new Date();
  private isInitialized: boolean = false;
  private useMockMode: boolean = false;
  
  constructor() {
    this.initializeService();
    
    // Initialize caches
    this.responseCache = new LRUCache<string, any>({
      max: 100,
      ttl: AI_CONFIG.CACHE_TTL * 1000,
    });
    
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 500,
      ttl: 24 * 60 * 60 * 1000,
    });
  }
  
  /**
   * Initialize OpenAI service with better validation
   */
  private initializeService(): void {
    const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    
    // تحقق من صحة API key
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured - using MOCK mode');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    // تحقق من أن الـ key يبدو صحيح
    if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
      console.warn('⚠️ OpenAI API key appears invalid - using MOCK mode');
      console.warn('   Key format should be: sk-... (40+ characters)');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    // تحقق إذا كان مجبور على Mock mode
    if (AI_CONFIG.USE_MOCK) {
      console.log('📝 MOCK_MODE enabled in environment - using mock responses');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    try {
      // Initialize OpenAI client
      this.client = new OpenAI({
        apiKey: apiKey,
        maxRetries: 3,
        timeout: 30000, // 30 seconds timeout
      });
      
      this.isInitialized = true;
      this.useMockMode = false;
      
      console.log('✅ OpenAI client initialized successfully');
      console.log(`   📊 Model: ${AI_CONFIG.MODEL}`);
      console.log(`   🎯 Temperature: ${AI_CONFIG.TEMPERATURE}`);
      console.log(`   📝 Max tokens: ${AI_CONFIG.MAX_TOKENS}`);
      
    } catch (error: any) {
      console.error('❌ Failed to initialize OpenAI client:', error.message);
      this.useMockMode = true;
      this.isInitialized = false;
    }
    
    // Initialize tokenizer
    try {
      this.encoder = encoding_for_model('gpt-3.5-turbo');
    } catch {
      console.warn('⚠️ Tokenizer initialization failed - using estimation');
    }
  }
  
  /**
   * Simple completion for direct prompt usage
   */
  async createCompletion(options: {
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<string> {
    // إذا في Mock mode، استخدم mock response
    if (this.useMockMode || !this.isInitialized) {
      console.log('📝 Using mock response (OpenAI not available)');
      return this.getMockResponse(options.prompt);
    }
    
    try {
      // تحويل البرومبت لرسالة
      const messages: ChatMessage[] = [
        { role: 'user', content: options.prompt }
      ];
      
      // استدعاء دالة chat الموجودة
      const response = await this.chat(messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        model: options.model
      });
      
      return response;
      
    } catch (error: any) {
      console.error('❌ createCompletion failed:', error.message);
      
      // معالجة أخطاء محددة
      if (error.message?.includes('401') || error.message?.includes('Incorrect API key')) {
        console.error('🔑 API key is invalid - switching to MOCK mode');
        this.useMockMode = true;
        this.isInitialized = false;
      }
      
      // Fallback to mock
      return this.getMockResponse(options.prompt);
    }
  }
  
  /**
   * Chat completion with improved error handling
   */
  async chat(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<string> {
    // Rate limiting
    this.requestCount++;
    const now = new Date();
    const timeSinceLastRequest = now.getTime() - this.lastRequestTime.getTime();
    
    if (timeSinceLastRequest < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
    }
    this.lastRequestTime = new Date();
    
    // If in mock mode, return mock response
    if (this.useMockMode || !this.isInitialized || !this.client) {
      const lastMessage = messages[messages.length - 1];
      const mockResponse = this.getMockResponse(lastMessage.content);
      console.log(`📝 Mock response: ${mockResponse.substring(0, 50)}...`);
      return mockResponse;
    }
    
    try {
      // حساب التوكنز
      const inputTokens = messages.reduce((sum, msg) => 
        sum + this.countTokens(msg.content), 0
      );
      
      console.log(`🤖 Calling OpenAI API (${inputTokens} input tokens)...`);
      
      const response = await this.client.chat.completions.create({
        model: options.model || AI_CONFIG.MODEL,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
      });
      
      const content = response.choices[0]?.message?.content || '';
      const outputTokens = this.countTokens(content);
      
      // حساب التكلفة
      const cost = this.calculateCost(
        options.model || AI_CONFIG.MODEL, 
        inputTokens, 
        outputTokens
      );
      
      console.log(`✅ OpenAI response received (${outputTokens} tokens, $${cost.toFixed(4)})`);
      
      return content;
      
    } catch (error: any) {
      console.error('❌ Chat completion failed:', error.message);
      
      // معالجة أنواع مختلفة من الأخطاء
      if (error.status === 401 || error.message?.includes('401')) {
        console.error('🔑 Invalid API key - switching to MOCK mode');
        this.useMockMode = true;
        this.isInitialized = false;
        this.client = null;
        return this.getMockResponse(messages[messages.length - 1].content);
      }
      
      if (error.status === 429 || error.message?.includes('rate_limit')) {
        console.log('⏳ Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Retry once
        return this.chat(messages, options);
      }
      
      if (error.status === 503 || error.message?.includes('Service unavailable')) {
        console.log('⚠️ OpenAI service unavailable - using mock');
        return this.getMockResponse(messages[messages.length - 1].content);
      }
      
      if (error.message?.includes('context_length_exceeded')) {
        console.log('📏 Context too long, truncating...');
        const truncatedMessages = this.truncateMessages(messages, AI_CONFIG.MAX_TOKENS);
        return this.chat(truncatedMessages, options);
      }
      
      // Fallback to mock for any other error
      return this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Chat with template support
   */
  async chatWithTemplate(
    promptType: PromptType,
    context: PromptContext,
    options: CompletionOptions = {}
  ): Promise<string> {
    const prompt = getPrompt(promptType, context);
    
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt }
    ];
    
    if (context.userMessage) {
      messages.push({ role: 'user', content: context.userMessage });
    }
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      for (const msg of context.conversationHistory) {
        const [role, content] = msg.split(': ', 2);
        messages.push({
          role: role === 'الطالب' ? 'user' : 'assistant',
          content: content || msg
        });
      }
    }
    
    const cacheKey = options.cacheKey || this.generateCacheKey(messages);
    if (options.useCache !== false && !this.useMockMode) {
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        console.log('📦 Returning cached response');
        return cached;
      }
    }
    
    const response = await this.chatWithRetry(messages, options);
    
    if (options.useCache !== false && !this.useMockMode) {
      this.responseCache.set(cacheKey, response);
    }
    
    return response;
  }
  
  /**
   * Chat with retry logic
   */
  private async chatWithRetry(
    messages: ChatMessage[],
    options: CompletionOptions = {},
    attempt: number = 1
  ): Promise<string> {
    try {
      return await this.chat(messages, options);
    } catch (error: any) {
      if (attempt >= AI_CONFIG.RETRY_COUNT) {
        // Final attempt - use mock
        console.log('📝 All retries failed - using mock response');
        return this.getMockResponse(messages[messages.length - 1].content);
      }
      
      console.warn(`⚠️ Attempt ${attempt} failed, retrying...`);
      
      const delay = AI_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.chatWithRetry(messages, options, attempt + 1);
    }
  }
  
  /**
   * Stream with template support
   */
  async *streamWithTemplate(
    promptType: PromptType,
    context: PromptContext,
    options: CompletionOptions = {}
  ): AsyncGenerator<string> {
    const prompt = getPrompt(promptType, context);
    
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt }
    ];
    
    if (context.userMessage) {
      messages.push({ role: 'user', content: context.userMessage });
    }
    
    yield* this.chatStream(messages, options);
  }
  
  /**
   * Function calling support
   */
  async chatWithFunctions(
    messages: ChatMessage[],
    functions: OpenAI.Chat.ChatCompletionCreateParams.Function[],
    options: CompletionOptions = {}
  ): Promise<{
    content?: string;
    functionCall?: {
      name: string;
      arguments: any;
    };
  }> {
    if (this.useMockMode || !this.client) {
      return { content: this.getMockResponse(messages[messages.length - 1].content) };
    }
    
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || AI_CONFIG.MODEL,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        functions,
        function_call: options.function_call || 'auto',
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
      });
      
      const message = response.choices[0]?.message;
      
      if (message?.function_call) {
        let args;
        try {
          args = JSON.parse(message.function_call.arguments);
        } catch {
          args = {};
        }
        
        return {
          functionCall: {
            name: message.function_call.name,
            arguments: args
          }
        };
      }
      
      return { content: message?.content || '' };
      
    } catch (error: any) {
      console.error('❌ Function calling failed:', error.message);
      return { content: this.getMockResponse(messages[messages.length - 1].content) };
    }
  }
  
  /**
   * تنظيف JSON من markdown blocks
   */
  private cleanJsonResponse(text: string): string {
    let cleaned = text;
    
    // إزالة markdown code blocks
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
    cleaned = cleaned.replace(/^```\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    cleaned = cleaned.replace(/```[a-z]*\n?/gi, '');
    
    // استخراج JSON object أو array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }
    
    return cleaned.trim();
  }
  
  /**
   * Chat completion expecting JSON response
   */
  async chatJSON<T = any>(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<T> {
    const enhancedMessages = [...messages];
    if (enhancedMessages[0]?.role === 'system') {
      enhancedMessages[0].content += '\n\nIMPORTANT: Respond ONLY with valid JSON. No text before or after the JSON.';
    } else {
      enhancedMessages.unshift({
        role: 'system',
        content: 'Respond ONLY with valid JSON. No text before or after the JSON.'
      });
    }
    
    const response = await this.chat(enhancedMessages, {
      ...options,
      temperature: options.temperature ?? 0.3,
    });
    
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('❌ JSON parsing failed:', error);
      console.log('Raw response (first 500 chars):', response.substring(0, 500));
      
      // Try to extract JSON from the response
      const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/;
      const match = response.match(jsonRegex);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // Fallback
        }
      }
      
      // Return empty object for mock mode
      if (this.useMockMode) {
        return {} as T;
      }
      
      return {} as T;
    }
  }
  
  /**
   * Generate text embedding with caching
   */
  async generateEmbedding(text: string, useCache: boolean = true): Promise<EmbeddingResponse> {
    if (useCache) {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        console.log('📦 Returning cached embedding');
        return {
          embedding: cached,
          tokens: Math.ceil(text.length / 4)
        };
      }
    }
    
    if (this.useMockMode || !this.client) {
      // Mock embedding for testing
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
      return {
        embedding: mockEmbedding,
        tokens: Math.ceil(text.length / 4),
      };
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: AI_CONFIG.EMBEDDING_MODEL,
        input: text,
      });
      
      const embedding = response.data[0].embedding;
      const tokens = response.usage?.total_tokens || 0;
      
      if (useCache) {
        this.embeddingCache.set(text, embedding);
      }
      
      const cost = this.calculateCost(AI_CONFIG.EMBEDDING_MODEL, tokens, 0);
      console.log(`💰 Embedding cost: $${cost.toFixed(4)}`);
      
      return {
        embedding,
        tokens,
      };
    } catch (error: any) {
      console.error('❌ Embedding generation failed:', error.message);
      
      // Return mock embedding on error
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
      return {
        embedding: mockEmbedding,
        tokens: Math.ceil(text.length / 4),
      };
    }
  }
  
  /**
   * Generate embeddings for multiple texts with batching
   */
  async generateEmbeddings(
    texts: string[],
    useCache: boolean = true
  ): Promise<EmbeddingResponse[]> {
    const results: EmbeddingResponse[] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    
    // Check cache first
    if (useCache) {
      for (let i = 0; i < texts.length; i++) {
        const cached = this.embeddingCache.get(texts[i]);
        if (cached) {
          results[i] = {
            embedding: cached,
            tokens: Math.ceil(texts[i].length / 4)
          };
        } else {
          uncachedTexts.push(texts[i]);
          uncachedIndices.push(i);
        }
      }
      
      if (uncachedTexts.length === 0) {
        console.log(`📦 All ${texts.length} embeddings from cache`);
        return results;
      }
    } else {
      uncachedTexts.push(...texts);
      uncachedIndices.push(...texts.map((_, i) => i));
    }
    
    // Batch process uncached texts
    const batchSize = 100;
    
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batch = uncachedTexts.slice(i, i + batchSize);
      const batchIndices = uncachedIndices.slice(i, i + batchSize);
      
      if (this.useMockMode || !this.client) {
        // Mock embeddings for testing
        batch.forEach((text, idx) => {
          const embedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
          results[batchIndices[idx]] = {
            embedding,
            tokens: Math.ceil(text.length / 4),
          };
        });
        continue;
      }
      
      try {
        const response = await this.client.embeddings.create({
          model: AI_CONFIG.EMBEDDING_MODEL,
          input: batch,
        });
        
        response.data.forEach((item, idx) => {
          const text = batch[idx];
          const originalIndex = batchIndices[idx];
          
          if (useCache) {
            this.embeddingCache.set(text, item.embedding);
          }
          
          results[originalIndex] = {
            embedding: item.embedding,
            tokens: Math.floor(text.length / 4),
          };
        });
        
      } catch (error: any) {
        console.error('❌ Batch embedding failed:', error.message);
        
        // Mock embeddings on error
        batch.forEach((text, idx) => {
          const embedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
          results[batchIndices[idx]] = {
            embedding,
            tokens: Math.ceil(text.length / 4),
          };
        });
      }
      
      // Rate limiting between batches
      if (i + batchSize < uncachedTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }
  
  /**
   * Stream chat completion
   */
  async *chatStream(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): AsyncGenerator<string> {
    if (this.useMockMode || !this.client) {
      yield this.getMockResponse(messages[messages.length - 1].content);
      return;
    }
    
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || AI_CONFIG.MODEL,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
        stream: true,
      });
      
      let fullResponse = '';
      
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        fullResponse += token;
        yield token;
      }
      
      const inputTokens = messages.reduce((sum, msg) => 
        sum + this.countTokens(msg.content), 0
      );
      const outputTokens = this.countTokens(fullResponse);
      const cost = this.calculateCost(
        options.model || AI_CONFIG.MODEL, 
        inputTokens, 
        outputTokens
      );
      console.log(`💰 Stream cost: $${cost.toFixed(4)}`);
      
    } catch (error: any) {
      console.error('❌ Chat stream failed:', error.message);
      yield this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Calculate cost for API usage
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-3-small': { input: 0.00002, output: 0 },
      'text-embedding-3-large': { input: 0.00013, output: 0 },
    };
    
    const modelPrices = prices[model] || prices['gpt-4o-mini'];
    const cost = (inputTokens * modelPrices.input + outputTokens * modelPrices.output) / 1000;
    
    this.totalCost += cost;
    
    if (this.totalCost > AI_CONFIG.MONTHLY_LIMIT) {
      console.warn(`⚠️ Monthly limit exceeded: $${this.totalCost.toFixed(2)} / $${AI_CONFIG.MONTHLY_LIMIT}`);
    }
    
    return cost;
  }
  
  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    if (!text) return 0;
    
    if (!this.encoder) {
      // تقدير تقريبي إذا لم يتوفر encoder
      // GPT models: ~4 characters per token for English, ~2-3 for Arabic
      const arabicRatio = (text.match(/[\u0600-\u06FF]/g) || []).length / text.length;
      const charsPerToken = arabicRatio > 0.5 ? 2.5 : 4;
      return Math.ceil(text.length / charsPerToken);
    }
    
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch {
      // Fallback estimation
      return Math.ceil(text.length / 3);
    }
  }
  
  /**
   * Truncate messages to fit within token limit
   */
  private truncateMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    const truncated: ChatMessage[] = [];
    let totalTokens = 0;
    
    // Always keep system message if present
    if (messages[0]?.role === 'system') {
      truncated.push(messages[0]);
      totalTokens += this.countTokens(messages[0].content);
    }
    
    // Add messages from newest to oldest until we hit the limit
    for (let i = messages.length - 1; i >= (truncated.length > 0 ? 1 : 0); i--) {
      const msg = messages[i];
      const tokens = this.countTokens(msg.content);
      
      if (totalTokens + tokens > maxTokens * 0.8) {
        break;
      }
      
      truncated.unshift(msg);
      totalTokens += tokens;
    }
    
    return truncated;
  }
  
  /**
   * Generate cache key from messages
   */
  private generateCacheKey(messages: ChatMessage[]): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  /**
   * Get enhanced mock response for testing
   */
  private getMockResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Educational responses
    const educationalResponses: Record<string, string> = {
      'welcome': 'مرحباً بك في درس اليوم! أنا مساعدك التعليمي الذكي. سنتعلم معاً خطوة بخطوة بطريقة ممتعة وسهلة. هل أنت مستعد للبدء؟ 🌟',
      'complete': 'أحسنت! لقد أكملت الدرس بنجاح! 🎉 أنت طالب رائع ومجتهد. لقد تعلمت اليوم أشياء جديدة ومفيدة. استمر في التقدم!',
      'math': 'الرياضيات لغة الكون! سنتعلم اليوم كيف نحل المعادلات خطوة بخطوة. كل معادلة هي لغز ممتع ننتظر حله!',
      'equation': 'لحل المعادلة، نتبع خطوات محددة: 1) نحدد المجهول 2) نجمع الحدود المتشابهة 3) نعزل المجهول 4) نتحقق من الحل',
      'example': 'مثال: إذا كان 2x + 5 = 15، نطرح 5 من الطرفين: 2x = 10، ثم نقسم على 2: x = 5. التحقق: 2(5) + 5 = 15 ✓',
      'help': 'أنا هنا لمساعدتك! يمكنك أن تسأل عن: شرح المفاهيم، حل التمارين، أمثلة إضافية، أو أي شيء متعلق بالدرس.',
      'explain': 'دعني أشرح لك بطريقة بسيطة: كل مفهوم جديد نتعلمه يبني على ما سبق. مثل بناء البيت، نبدأ بالأساس ثم نبني طابقاً تلو الآخر.',
      'quiz': 'حان وقت الاختبار! سأطرح عليك بعض الأسئلة لنرى ما تعلمته. لا تقلق، الهدف هو التعلم وليس الدرجات فقط.',
      'excellent': 'ممتاز! إجابة صحيحة 100%! أنت تفهم المفهوم جيداً. هل تريد تحدياً أصعب؟',
      'tryagain': 'لا بأس، المحاولة جزء من التعلم! دعنا نحاول مرة أخرى. تذكر القاعدة التي تعلمناها.',
    };
    
    // Math-specific responses
    if (lowerMessage.includes('معادل') || lowerMessage.includes('حل')) {
      return educationalResponses.equation;
    }
    
    if (lowerMessage.includes('مثال') || lowerMessage.includes('مسألة')) {
      return educationalResponses.example;
    }
    
    if (lowerMessage.includes('رحب') || lowerMessage.includes('welcome')) {
      return educationalResponses.welcome;
    }
    
    if (lowerMessage.includes('أكمل') || lowerMessage.includes('complete')) {
      return educationalResponses.complete;
    }
    
    if (lowerMessage.includes('رياض') || lowerMessage.includes('math')) {
      return educationalResponses.math;
    }
    
    if (lowerMessage.includes('ساعد') || lowerMessage.includes('help')) {
      return educationalResponses.help;
    }
    
    if (lowerMessage.includes('شرح') || lowerMessage.includes('explain')) {
      return educationalResponses.explain;
    }
    
    if (lowerMessage.includes('اختبار') || lowerMessage.includes('quiz')) {
      return educationalResponses.quiz;
    }
    
    // Default educational response
    return 'أنا مساعدك التعليمي الذكي. أنا هنا لمساعدتك في فهم الدروس وحل التمارين. كيف يمكنني مساعدتك اليوم؟ 📚';
  }
  
  /**
   * Clear caches
   */
  clearCaches(): void {
    this.responseCache.clear();
    this.embeddingCache.clear();
    console.log('🧹 Caches cleared');
  }
  
  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    mode: 'production' | 'mock';
    model: string;
    totalCost: string;
    requestCount: number;
  } {
    return {
      initialized: this.isInitialized,
      mode: this.useMockMode ? 'mock' : 'production',
      model: AI_CONFIG.MODEL,
      totalCost: `$${this.totalCost.toFixed(2)}`,
      requestCount: this.requestCount
    };
  }
  
  /**
   * Get usage statistics
   */
  getUsageStats() {
    const cacheStats = {
      responseCacheSize: this.responseCache.size,
      embeddingCacheSize: this.embeddingCache.size,
    };
    
    return {
      status: this.isInitialized ? 'active' : 'mock',
      mode: this.useMockMode ? 'mock' : 'production',
      totalCost: `$${this.totalCost.toFixed(2)}`,
      monthlyLimit: `$${AI_CONFIG.MONTHLY_LIMIT}`,
      remainingBudget: `$${(AI_CONFIG.MONTHLY_LIMIT - this.totalCost).toFixed(2)}`,
      percentUsed: `${((this.totalCost / AI_CONFIG.MONTHLY_LIMIT) * 100).toFixed(1)}%`,
      model: AI_CONFIG.MODEL,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime.toISOString(),
      cacheStats,
    };
  }
  
  /**
   * Reset monthly usage
   */
  resetMonthlyUsage(): void {
    this.totalCost = 0;
    this.requestCount = 0;
    console.log('📊 Monthly usage reset');
  }
  
  /**
   * Force mock mode (for testing)
   */
  forceMockMode(enabled: boolean): void {
    this.useMockMode = enabled;
    console.log(`📝 Mock mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized || this.useMockMode;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();