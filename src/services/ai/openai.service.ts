// 📍 المكان: src/services/ai/openai.service.ts
// الوظيفة: خدمة OpenAI المحسّنة مع دعم Templates و Function Calling

import OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';
import { LRUCache } from 'lru-cache'; // ✅ Import صحيح
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
  
  constructor() {
    // Initialize OpenAI client
    if (config.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
      console.log('✅ OpenAI client initialized with model:', AI_CONFIG.MODEL);
    } else {
      console.warn('⚠️ OpenAI API key not configured - using mock mode');
    }
    
    // Initialize tokenizer
    try {
      this.encoder = encoding_for_model('gpt-3.5-turbo');
    } catch {
      console.warn('⚠️ Tokenizer initialization failed');
    }
    
    // Initialize caches with correct syntax
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
    if (options.useCache !== false) {
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        console.log('📦 Returning cached response');
        return cached;
      }
    }
    
    const response = await this.chatWithRetry(messages, options);
    
    if (options.useCache !== false) {
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
        throw error;
      }
      
      console.warn(`⚠️ Attempt ${attempt} failed, retrying...`);
      
      const delay = AI_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.chatWithRetry(messages, options, attempt + 1);
    }
  }
  
  /**
   * Stream chat with template support
   */
  async *streamWithTemplate(
    promptType: PromptType,
    context: PromptContext,
    options: CompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
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
    if (!this.client) {
      return { content: this.getMockResponse(messages[messages.length - 1].content) };
    }
    
    try {
      const response = await this.client.chat.completions.create({
        model: AI_CONFIG.MODEL,
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
   * Chat completion expecting JSON response
   */
  async chatJSON(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<any> {
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
      
      const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/;
      const match = response.match(jsonRegex);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // Fallback
        }
      }
      
      return {};
    }
  }
  
  /**
   * Batch processing for multiple prompts
   */
  async batchProcess<T>(
    items: Array<{
      messages: ChatMessage[];
      options?: CompletionOptions;
    }>,
    concurrency: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(item => this.chatJSON(item.messages, item.options))
      );
      results.push(...batchResults);
      
      if (i + concurrency < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
  
  /**
   * Calculate cost for API usage
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-3-small': { input: 0.00002, output: 0 },
    };
    
    const modelPrices = prices[model] || prices['gpt-4o-mini'];
    const cost = (inputTokens * modelPrices.input + outputTokens * modelPrices.output) / 1000;
    
    this.totalCost += cost;
    
    if (this.totalCost > AI_CONFIG.MONTHLY_LIMIT) {
      console.warn(`⚠️ Monthly limit reached: $${this.totalCost.toFixed(2)}`);
    }
    
    return cost;
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
    
    if (!this.client) {
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
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
      
      return {
        embedding: Array(1536).fill(0).map(() => Math.random()),
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
    
    const batchSize = 100;
    
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batch = uncachedTexts.slice(i, i + batchSize);
      const batchIndices = uncachedIndices.slice(i, i + batchSize);
      
      if (!this.client) {
        batch.forEach((text, idx) => {
          const embedding = Array(1536).fill(0).map(() => Math.random());
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
        
        batch.forEach((text, idx) => {
          const embedding = Array(1536).fill(0).map(() => Math.random());
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
   * Chat completion with improved error handling
   */
  async chat(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<string> {
    this.requestCount++;
    const now = new Date();
    const timeSinceLastRequest = now.getTime() - this.lastRequestTime.getTime();
    
    if (timeSinceLastRequest < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
    }
    this.lastRequestTime = new Date();
    
    if (!this.client) {
      return this.getMockResponse(messages[messages.length - 1].content);
    }
    
    try {
      const inputTokens = messages.reduce((sum, msg) => 
        sum + this.countTokens(msg.content), 0
      );
      
      const response = await this.client.chat.completions.create({
        model: AI_CONFIG.MODEL,
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
      
      const cost = this.calculateCost(AI_CONFIG.MODEL, inputTokens, outputTokens);
      console.log(`💰 Chat cost: $${cost.toFixed(4)} | Total: $${this.totalCost.toFixed(2)}`);
      
      return content;
    } catch (error: any) {
      console.error('❌ Chat completion failed:', error.message);
      
      if (error.message?.includes('rate_limit')) {
        console.log('⏳ Rate limited, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.chat(messages, options);
      }
      
      if (error.message?.includes('context_length_exceeded')) {
        console.log('📏 Context too long, truncating...');
        const truncatedMessages = this.truncateMessages(messages, AI_CONFIG.MAX_TOKENS);
        return this.chat(truncatedMessages, options);
      }
      
      return this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Stream chat completion
   */
  async *chatStream(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      yield this.getMockResponse(messages[messages.length - 1].content);
      return;
    }
    
    try {
      const stream = await this.client.chat.completions.create({
        model: AI_CONFIG.MODEL,
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
      const cost = this.calculateCost(AI_CONFIG.MODEL, inputTokens, outputTokens);
      console.log(`💰 Stream cost: $${cost.toFixed(4)}`);
      
    } catch (error: any) {
      console.error('❌ Chat stream failed:', error.message);
      yield this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Stream with callback support
   */
  async streamWithCallbacks(
    messages: ChatMessage[],
    options: CompletionOptions & StreamOptions = {}
  ): Promise<string> {
    let fullText = '';
    
    try {
      const stream = this.chatStream(messages, options);
      
      for await (const token of stream) {
        fullText += token;
        options.onToken?.(token);
      }
      
      options.onComplete?.(fullText);
      return fullText;
      
    } catch (error: any) {
      options.onError?.(error);
      throw error;
    }
  }
  
  /**
   * Generate structured output with Zod schema
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    const zodJsonSchema = JSON.stringify(schema._def, null, 2);
    
    const systemPrompt = `You are a JSON generator that ALWAYS returns valid JSON.
Your response must match this schema EXACTLY:
${zodJsonSchema}

CRITICAL: Respond ONLY with valid JSON. No markdown, no explanations, just the JSON object.`;
    
    const response = await this.chatJSON(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { ...options, temperature: 0.2 }
    );
    
    try {
      return schema.parse(response);
    } catch (error: any) {
      console.error('❌ Schema validation failed:', error.errors);
      
      const fixed = this.tryFixJsonStructure(response, schema);
      if (fixed) {
        return schema.parse(fixed);
      }
      
      throw new Error('Invalid structured response from AI');
    }
  }
  
  /**
   * Try to fix common JSON structure issues
   */
  private tryFixJsonStructure(obj: any, schema: z.ZodSchema): any {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }
    
    try {
      const fixed = { ...obj };
      
      for (const key in fixed) {
        if (typeof fixed[key] === 'string' && /^\d+(\.\d+)?$/.test(fixed[key])) {
          fixed[key] = parseFloat(fixed[key]);
        }
      }
      
      return fixed;
    } catch {
      return null;
    }
  }
  
  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    if (!this.encoder) {
      return Math.ceil(text.length / 2.5);
    }
    
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch {
      return Math.ceil(text.length / 2.5);
    }
  }
  
  /**
   * Split text into chunks by token count
   */
  splitTextByTokens(text: string, maxTokens: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?؟]\s+/);
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  /**
   * Truncate messages to fit within token limit
   */
  private truncateMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    const truncated: ChatMessage[] = [];
    let totalTokens = 0;
    
    if (messages[0]?.role === 'system') {
      truncated.push(messages[0]);
      totalTokens += this.countTokens(messages[0].content);
    }
    
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
   * Get mock response for testing
   */
  private getMockResponse(message: string): string {
    const mockResponses: Record<string, string> = {
      'الأعداد': 'الأعداد الطبيعية هي الأعداد التي نستخدمها في العد: 1، 2، 3، 4، وهكذا. كل عدد له قيمة محددة ويمكن استخدامه في العمليات الحسابية.',
      'الكسور': 'الكسر هو جزء من الكل، مثل 1/2 (نصف) أو 1/4 (ربع). البسط هو العدد العلوي والمقام هو العدد السفلي.',
      'الضرب': 'الضرب هو جمع متكرر. مثلاً: 3 × 4 يعني 3 + 3 + 3 + 3 = 12. يمكنك أيضاً التفكير فيه كمجموعات: 3 مجموعات من 4.',
      'القسمة': 'القسمة هي توزيع عدد على أجزاء متساوية. مثلاً: 12 ÷ 3 = 4 يعني توزيع 12 على 3 مجموعات متساوية.',
      'مرحبا': 'مرحباً! أنا مساعدك التعليمي الذكي. كيف يمكنني مساعدتك اليوم في التعلم؟',
      'مثال': 'إليك مثال بسيط: إذا كان لديك 5 تفاحات وأعطيت صديقك 2، كم تفاحة ستبقى معك؟ الإجابة: 5 - 2 = 3 تفاحات.',
      'default': 'شكراً لسؤالك! أنا في وضع التجربة حالياً. يُرجى إضافة OpenAI API key للحصول على إجابات كاملة ومفصلة.',
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [key, value] of Object.entries(mockResponses)) {
      if (lowerMessage.includes(key)) {
        return value;
      }
    }
    
    return mockResponses.default;
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
   * Get usage statistics
   */
  getUsageStats() {
    const cacheStats = {
      responseCacheSize: this.responseCache.size,
      embeddingCacheSize: this.embeddingCache.size,
    };
    
    return {
      totalCost: this.totalCost.toFixed(2),
      monthlyLimit: AI_CONFIG.MONTHLY_LIMIT,
      remainingBudget: (AI_CONFIG.MONTHLY_LIMIT - this.totalCost).toFixed(2),
      percentUsed: ((this.totalCost / AI_CONFIG.MONTHLY_LIMIT) * 100).toFixed(1),
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
}

// Export singleton instance
export const openAIService = new OpenAIService();