// 📍 المكان: src/services/ai/openai.service.ts
// ✨ النسخة المحسنة مع Multi-Model Strategy و Cost Optimization

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

// ============= 🆕 SMART MODEL SELECTION =============
export interface TaskAnalysis {
  type: 'simple_qa' | 'explanation' | 'math' | 'creative' | 'arabic' | 'quiz' | 'unknown';
  complexity: number; // 1-10
  expectedLength: number; // expected response length
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  language: 'ar' | 'en' | 'mixed';
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
  model?: string;
  // 🆕 Smart selection
  autoSelectModel?: boolean;
  taskType?: TaskAnalysis['type'];
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

// ============= 🆕 MODEL CONFIGURATIONS =============
const MODEL_CONFIGS = {
  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
    maxTokens: 16385,
    bestFor: ['simple_qa', 'translation', 'summary'],
    speed: 'fast',
    quality: 'good'
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    maxTokens: 128000,
    bestFor: ['general', 'balanced'],
    speed: 'fast',
    quality: 'very_good'
  },
  'gpt-4o': {
    name: 'gpt-4o',
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    maxTokens: 128000,
    bestFor: ['complex', 'analysis', 'creative'],
    speed: 'medium',
    quality: 'excellent'
  },
  'gpt-4-turbo': {
    name: 'gpt-4-turbo',
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    maxTokens: 128000,
    bestFor: ['arabic', 'explanation', 'teaching'],
    speed: 'medium',
    quality: 'excellent'
  }
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
  
  // 🆕 Performance tracking
  private modelUsageStats: Map<string, {
    count: number;
    totalCost: number;
    avgResponseTime: number;
    successRate: number;
  }> = new Map();
  
  constructor() {
    this.initializeService();
    
    // Initialize caches with better config
    this.responseCache = new LRUCache<string, any>({
      max: 200, // Increased
      ttl: AI_CONFIG.CACHE_TTL * 1000,
      updateAgeOnGet: true, // Keep fresh items in cache
    });
    
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 1000, // Increased
      ttl: 7 * 24 * 60 * 60 * 1000, // 1 week
    });
  }
  
  /**
   * Initialize OpenAI service with better validation
   */
  private initializeService(): void {
    const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured - using MOCK mode');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
      console.warn('⚠️ OpenAI API key appears invalid - using MOCK mode');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    if (AI_CONFIG.USE_MOCK) {
      console.log('📝 MOCK_MODE enabled in environment');
      this.useMockMode = true;
      this.isInitialized = false;
      return;
    }
    
    try {
      this.client = new OpenAI({
        apiKey: apiKey,
        maxRetries: 5,
        timeout: 1200000,
      });
      
      this.isInitialized = true;
      this.useMockMode = false;
      
      console.log('✅ OpenAI client initialized');
      console.log(`   📊 Default Model: ${AI_CONFIG.MODEL}`);
      console.log(`   💰 Monthly Limit: $${AI_CONFIG.MONTHLY_LIMIT}`);
      
    } catch (error: any) {
      console.error('❌ Failed to initialize OpenAI client:', error.message);
      this.useMockMode = true;
      this.isInitialized = false;
    }
    
    try {
      this.encoder = encoding_for_model('gpt-3.5-turbo');
    } catch {
      console.warn('⚠️ Tokenizer initialization failed - using estimation');
    }
  }
  
  /**
   * 🆕 Analyze task to select best model
   */
  private analyzeTask(messages: ChatMessage[]): TaskAnalysis {
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    const fullContext = messages.map(m => m.content).join(' ').toLowerCase();
    
    // Detect language
    const arabicRatio = (fullContext.match(/[\u0600-\u06FF]/g) || []).length / fullContext.length;
    const language = arabicRatio > 0.3 ? 'ar' : arabicRatio > 0 ? 'mixed' : 'en';
    
    // Detect task type
    let type: TaskAnalysis['type'] = 'unknown';
    let complexity = 5;
    let requiresReasoning = false;
    let requiresCreativity = false;
    
    // Simple Q&A patterns
    if (lastMessage.includes('ما هو') || lastMessage.includes('what is') || 
        lastMessage.includes('متى') || lastMessage.includes('when')) {
      type = 'simple_qa';
      complexity = 2;
    }
    // Math patterns
    else if (lastMessage.includes('حل') || lastMessage.includes('معادلة') || 
             lastMessage.includes('solve') || lastMessage.includes('calculate')) {
      type = 'math';
      complexity = 7;
      requiresReasoning = true;
    }
    // Explanation patterns
    else if (lastMessage.includes('اشرح') || lastMessage.includes('explain') ||
             lastMessage.includes('كيف') || lastMessage.includes('how')) {
      type = 'explanation';
      complexity = 6;
    }
    // Creative patterns
    else if (lastMessage.includes('قصة') || lastMessage.includes('story') ||
             lastMessage.includes('اكتب') || lastMessage.includes('write')) {
      type = 'creative';
      complexity = 7;
      requiresCreativity = true;
    }
    // Quiz patterns
    else if (lastMessage.includes('اختبار') || lastMessage.includes('quiz') ||
             lastMessage.includes('سؤال') || lastMessage.includes('question')) {
      type = 'quiz';
      complexity = 5;
    }
    // Arabic content
    else if (language === 'ar' && complexity > 3) {
      type = 'arabic';
      complexity = 6;
    }
    
    // Estimate expected length
    const expectedLength = complexity < 3 ? 200 : complexity < 6 ? 500 : 1000;
    
    return {
      type,
      complexity,
      expectedLength,
      requiresReasoning,
      requiresCreativity,
      language
    };
  }
  
  /**
   * 🆕 Select optimal model based on task
   */
  private selectModel(task: TaskAnalysis, preferredModel?: string): string {
    // If model explicitly specified, use it
    if (preferredModel && preferredModel in MODEL_CONFIGS) {
      return preferredModel;
    }
    
    // Budget check
    const budgetRemaining = AI_CONFIG.MONTHLY_LIMIT - this.totalCost;
    const isLowBudget = budgetRemaining < 2;
    
    // Smart selection based on task
    if (task.type === 'simple_qa' || isLowBudget) {
      return 'gpt-3.5-turbo'; // Fast & cheap
    } else if (task.type === 'math' && task.requiresReasoning) {
      return 'gpt-4o'; // Best for reasoning
    } else if (task.type === 'arabic' || task.language === 'ar') {
      return 'gpt-4-turbo'; // Best for Arabic
    } else if (task.type === 'creative' && task.requiresCreativity) {
      return 'gpt-4-turbo'; // Creative writing
    } else if (task.type === 'explanation') {
      return 'gpt-4o-mini'; // Balanced
    } else if (task.complexity < 4) {
      return 'gpt-3.5-turbo'; // Simple tasks
    } else if (task.complexity > 7) {
      return 'gpt-4o'; // Complex tasks
    } else {
      return 'gpt-4o-mini'; // Default balanced
    }
  }
  
  /**
   * Chat completion with smart model selection
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
    
    // Mock mode
    if (this.useMockMode || !this.isInitialized || !this.client) {
      const lastMessage = messages[messages.length - 1];
      return this.getMockResponse(lastMessage.content);
    }
    
    // 🆕 Smart model selection
    let selectedModel = options.model || AI_CONFIG.MODEL;
    if (options.autoSelectModel !== false) {
      const task = this.analyzeTask(messages);
      selectedModel = this.selectModel(task, options.model);
      
      if (selectedModel !== (options.model || AI_CONFIG.MODEL)) {
        console.log(`🧠 Smart selection: ${selectedModel} for ${task.type} task`);
      }
    }
    
    const startTime = Date.now();
    
    try {
      const inputTokens = messages.reduce((sum, msg) => 
        sum + this.countTokens(msg.content), 0
      );
      
      // Adjust max tokens based on model
      const modelConfig = MODEL_CONFIGS[selectedModel as keyof typeof MODEL_CONFIGS];
      const maxTokens = Math.min(
        options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
        modelConfig?.maxTokens ?? 4000
      );
      
      console.log(`🤖 Using ${selectedModel} (${inputTokens} tokens)...`);
      
      const response = await this.client.chat.completions.create({
        model: selectedModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: maxTokens,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
      });
      
      const content = response.choices[0]?.message?.content || '';
      const outputTokens = this.countTokens(content);
      const responseTime = Date.now() - startTime;
      
      // Calculate cost
      const cost = this.calculateCost(selectedModel, inputTokens, outputTokens);
      
      // 🆕 Track model performance
      this.trackModelUsage(selectedModel, cost, responseTime, true);
      
      console.log(`✅ Response: ${outputTokens} tokens, ${responseTime}ms, $${cost.toFixed(4)}`);
      
      return content;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.trackModelUsage(selectedModel, 0, responseTime, false);
      
      console.error('❌ Chat failed:', error.message);
      
      // Smart retry with cheaper model
      if (error.status === 429 && selectedModel !== 'gpt-3.5-turbo') {
        console.log('⏳ Rate limited, trying cheaper model...');
        return this.chat(messages, { ...options, model: 'gpt-3.5-turbo' });
      }
      
      // Other error handling
      if (error.status === 401) {
        this.useMockMode = true;
        this.isInitialized = false;
        this.client = null;
        return this.getMockResponse(messages[messages.length - 1].content);
      }
      
      if (error.message?.includes('context_length_exceeded')) {
        console.log('📏 Context too long, truncating...');
        const truncatedMessages = this.truncateMessages(messages, 2000);
        return this.chat(truncatedMessages, options);
      }
      
      return this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * 🆕 Track model usage statistics
   */
  private trackModelUsage(
    model: string, 
    cost: number, 
    responseTime: number, 
    success: boolean
  ): void {
    const stats = this.modelUsageStats.get(model) || {
      count: 0,
      totalCost: 0,
      avgResponseTime: 0,
      successRate: 0
    };
    
    stats.count++;
    stats.totalCost += cost;
    stats.avgResponseTime = (stats.avgResponseTime * (stats.count - 1) + responseTime) / stats.count;
    stats.successRate = (stats.successRate * (stats.count - 1) + (success ? 100 : 0)) / stats.count;
    
    this.modelUsageStats.set(model, stats);
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
        console.log('📦 Cache hit!');
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
   * Chat with smart retry logic
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
        console.log('📝 All retries failed - using mock');
        return this.getMockResponse(messages[messages.length - 1].content);
      }
      
      console.warn(`⚠️ Attempt ${attempt} failed, retrying...`);
      
      // Exponential backoff
      const delay = AI_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Try cheaper model on retry
      if (attempt > 1 && options.model !== 'gpt-3.5-turbo') {
        options.model = 'gpt-3.5-turbo';
        console.log('💡 Switching to cheaper model for retry');
      }
      
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
      // Use smarter model for function calls
      const model = options.model || 'gpt-4o-mini';
      
      const response = await this.client.chat.completions.create({
        model,
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
   * Clean JSON from markdown
   */
  private cleanJsonResponse(text: string): string {
    let cleaned = text;
    
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
    cleaned = cleaned.replace(/^```\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    cleaned = cleaned.replace(/```[a-z]*\n?/gi, '');
    
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }
    
    return cleaned.trim();
  }
  
  /**
   * Chat expecting JSON response
   */
  async chatJSON<T = any>(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<T> {
    const enhancedMessages = [...messages];
    if (enhancedMessages[0]?.role === 'system') {
      enhancedMessages[0].content += '\n\nIMPORTANT: Respond ONLY with valid JSON. No text before or after.';
    } else {
      enhancedMessages.unshift({
        role: 'system',
        content: 'Respond ONLY with valid JSON. No text before or after.'
      });
    }
    
    // Use lower temperature for JSON
    const response = await this.chat(enhancedMessages, {
      ...options,
      temperature: options.temperature ?? 0.3,
      model: options.model || 'gpt-4o-mini', // Better for structured output
    });
    
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('❌ JSON parsing failed');
      
      const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/;
      const match = response.match(jsonRegex);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // Fallback
        }
      }
      
      return {} as T;
    }
  }
  
  /**
   * Generate embedding with caching
   */
  async generateEmbedding(text: string, useCache: boolean = true): Promise<EmbeddingResponse> {
    if (useCache) {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        console.log('📦 Cached embedding');
        return {
          embedding: cached,
          tokens: Math.ceil(text.length / 4)
        };
      }
    }
    
    if (this.useMockMode || !this.client) {
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
      
      return {
        embedding,
        tokens,
      };
    } catch (error: any) {
      console.error('❌ Embedding failed:', error.message);
      
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
      return {
        embedding: mockEmbedding,
        tokens: Math.ceil(text.length / 4),
      };
    }
  }
  
  /**
   * Batch generate embeddings
   */
  async generateEmbeddings(
    texts: string[],
    useCache: boolean = true
  ): Promise<EmbeddingResponse[]> {
    const results: EmbeddingResponse[] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    
    // Check cache
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
        console.log(`📦 All ${texts.length} embeddings cached`);
        return results;
      }
    } else {
      uncachedTexts.push(...texts);
      uncachedIndices.push(...texts.map((_, i) => i));
    }
    
    // Batch process
    const batchSize = 100;
    
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batch = uncachedTexts.slice(i, i + batchSize);
      const batchIndices = uncachedIndices.slice(i, i + batchSize);
      
      if (this.useMockMode || !this.client) {
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
        console.error('❌ Batch embedding failed');
        
        batch.forEach((text, idx) => {
          const embedding = Array(1536).fill(0).map(() => Math.random() - 0.5);
          results[batchIndices[idx]] = {
            embedding,
            tokens: Math.ceil(text.length / 4),
          };
        });
      }
      
      if (i + batchSize < uncachedTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }
  
  /**
   * Stream chat
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
      // Smart model selection for streaming
      const task = this.analyzeTask(messages);
      const model = options.model || this.selectModel(task);
      
      const stream = await this.client.chat.completions.create({
        model,
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
      const cost = this.calculateCost(model, inputTokens, outputTokens);
      
    } catch (error: any) {
      console.error('❌ Stream failed');
      yield this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Calculate cost with model configs
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const modelConfig = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];
    const costPer1kInput = modelConfig?.costPer1kInput || 0.001;
    const costPer1kOutput = modelConfig?.costPer1kOutput || 0.002;
    
    const cost = (inputTokens * costPer1kInput + outputTokens * costPer1kOutput) / 1000;
    
    this.totalCost += cost;
    
    if (this.totalCost > AI_CONFIG.MONTHLY_LIMIT * 0.8) {
      console.warn(`⚠️ Approaching limit: $${this.totalCost.toFixed(2)}/$${AI_CONFIG.MONTHLY_LIMIT}`);
    }
    
    return cost;
  }
  
  /**
   * Count tokens
   */
  countTokens(text: string): number {
    if (!text) return 0;
    
    if (!this.encoder) {
      const arabicRatio = (text.match(/[\u0600-\u06FF]/g) || []).length / text.length;
      const charsPerToken = arabicRatio > 0.5 ? 2.5 : 4;
      return Math.ceil(text.length / charsPerToken);
    }
    
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch {
      return Math.ceil(text.length / 3);
    }
  }
  
  /**
   * Truncate messages smartly
   */
  private truncateMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    const truncated: ChatMessage[] = [];
    let totalTokens = 0;
    
    // Keep system message
    if (messages[0]?.role === 'system') {
      truncated.push(messages[0]);
      totalTokens += this.countTokens(messages[0].content);
    }
    
    // Add recent messages
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
   * Generate cache key
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
   * Enhanced mock responses
   */
  private getMockResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    const educationalResponses: Record<string, string> = {
      'welcome': 'مرحباً بك! أنا مساعدك التعليمي الذكي. سنتعلم معاً بطريقة ممتعة وسهلة! 🌟',
      'complete': 'أحسنت! لقد أكملت الدرس بنجاح! 🎉 أنت طالب رائع ومجتهد!',
      'math': 'الرياضيات لغة الكون! سنتعلم اليوم كيف نحل المعادلات خطوة بخطوة.',
      'equation': 'لحل المعادلة: 1) نحدد المجهول 2) نجمع الحدود المتشابهة 3) نعزل المجهول',
      'example': 'مثال: إذا كان 2x + 5 = 15، نطرح 5: 2x = 10، نقسم على 2: x = 5 ✓',
      'help': 'أنا هنا لمساعدتك! اسأل عن أي شيء في الدرس.',
      'explain': 'دعني أشرح لك: كل مفهوم جديد يبني على ما سبق.',
      'quiz': 'وقت الاختبار! سأطرح عليك أسئلة لنرى ما تعلمته.',
      'excellent': 'ممتاز! إجابة صحيحة 100%!',
      'tryagain': 'لا بأس، المحاولة جزء من التعلم! حاول مرة أخرى.',
    };
    
    if (lowerMessage.includes('معادل') || lowerMessage.includes('حل')) {
      return educationalResponses.equation;
    }
    
    if (lowerMessage.includes('مثال')) {
      return educationalResponses.example;
    }
    
    if (lowerMessage.includes('شرح')) {
      return educationalResponses.explain;
    }
    
    if (lowerMessage.includes('اختبار') || lowerMessage.includes('quiz')) {
      return educationalResponses.quiz;
    }
    
    return 'أنا مساعدك التعليمي. كيف يمكنني مساعدتك؟ 📚';
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
   * 🆕 Get detailed usage statistics
   */
  getUsageStats() {
    const modelStats = Array.from(this.modelUsageStats.entries()).map(([model, stats]) => ({
      model,
      ...stats,
      avgCostPerRequest: stats.count > 0 ? stats.totalCost / stats.count : 0
    }));
    
    const cacheStats = {
      responseCacheSize: this.responseCache.size,
      responseCacheHitRate: this.responseCache.size > 0 ? 
        `${((this.responseCache.size / (this.requestCount || 1)) * 100).toFixed(1)}%` : '0%',
      embeddingCacheSize: this.embeddingCache.size,
    };
    
    const costBreakdown = {
      total: `$${this.totalCost.toFixed(2)}`,
      limit: `$${AI_CONFIG.MONTHLY_LIMIT}`,
      remaining: `$${(AI_CONFIG.MONTHLY_LIMIT - this.totalCost).toFixed(2)}`,
      percentUsed: `${((this.totalCost / AI_CONFIG.MONTHLY_LIMIT) * 100).toFixed(1)}%`,
      projectedMonthly: `$${(this.totalCost * 30).toFixed(2)}`, // Rough projection
    };
    
    return {
      status: this.isInitialized ? 'active' : 'mock',
      mode: this.useMockMode ? 'mock' : 'production',
      defaultModel: AI_CONFIG.MODEL,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime.toISOString(),
      modelStats,
      cacheStats,
      costBreakdown,
      recommendations: this.getOptimizationRecommendations()
    };
  }
  
  /**
   * 🆕 Get optimization recommendations
   */
  private getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Cost recommendations
    if (this.totalCost > AI_CONFIG.MONTHLY_LIMIT * 0.5) {
      recommendations.push('Consider using gpt-3.5-turbo more for simple tasks');
    }
    
    // Cache recommendations
    if (this.responseCache.size < 50 && this.requestCount > 100) {
      recommendations.push('Enable response caching to reduce API calls');
    }
    
    // Model usage recommendations
    const modelStats = Array.from(this.modelUsageStats.entries());
    const expensiveModelUsage = modelStats.filter(([m]) => 
      m.includes('gpt-4')).reduce((sum, [, stats]) => sum + stats.count, 0);
    
    if (expensiveModelUsage > this.requestCount * 0.7) {
      recommendations.push('Using expensive models too often - enable auto model selection');
    }
    
    return recommendations;
  }
  
  /**
   * Reset monthly usage
   */
  resetMonthlyUsage(): void {
    this.totalCost = 0;
    this.requestCount = 0;
    this.modelUsageStats.clear();
    console.log('📊 Monthly usage reset');
  }
  
  /**
   * Force mock mode
   */
  forceMockMode(enabled: boolean): void {
    this.useMockMode = enabled;
    console.log(`📝 Mock mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.isInitialized || this.useMockMode;
  }

  /**
   * Compatibility helper: simple text completion from a single prompt.
   * Accepts a raw string prompt and optional options, returns assistant text.
   * Internally uses chat() with a single user message for consistency with
   * the rest of the service (smart model selection, cost tracking, etc.).
   */
  async generateCompletion(prompt: string, options: CompletionOptions = {}): Promise<string> {
    // If caller passed an empty prompt, return early to avoid unnecessary call
    if (!prompt || !prompt.trim()) {
      return '';
    }
    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];
    return this.chat(messages, options);
  }
}

// Export singleton
export const openAIService = new OpenAIService();