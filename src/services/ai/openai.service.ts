import OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';
import { config } from '../../config';
import { z } from 'zod';

// Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
}

// Configuration from environment
const AI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  MONTHLY_LIMIT: parseFloat(process.env.OPENAI_MONTHLY_LIMIT || '10'),
};

// Service class
export class OpenAIService {
  private client: OpenAI | null = null;
  private encoder: any;
  private totalCost: number = 0;
  
  constructor() {
    // Initialize OpenAI client only if API key exists
    if (config.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
      console.log('✅ OpenAI client initialized with model:', AI_CONFIG.MODEL);
    } else {
      console.warn('⚠️ OpenAI API key not configured - using mock mode');
    }
    
    // Initialize tokenizer for cost calculation
    try {
      this.encoder = encoding_for_model('gpt-3.5-turbo');
    } catch {
      console.warn('⚠️ Tokenizer initialization failed');
    }
  }
  
  /**
   * تنظيف JSON من markdown blocks - دالة جديدة مهمة
   */
  private cleanJsonResponse(text: string): string {
    // إزالة markdown code blocks
    let cleaned = text;
    
    // إزالة ```json من البداية و``` من النهاية
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
    cleaned = cleaned.replace(/^```\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    
    // إزالة أي markdown blocks أخرى
    cleaned = cleaned.replace(/```[a-z]*\n?/gi, '');
    
    // تنظيف المسافات الزائدة
    cleaned = cleaned.trim();
    
    return cleaned;
  }
  
  /**
   * Chat completion expecting JSON response - دالة جديدة للـ Multi-Agent
   */
  async chatJSON(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<any> {
    const response = await this.chat(messages, {
      ...options,
      temperature: options.temperature ?? 0.5, // أقل عشوائية للـ JSON
    });
    
    try {
      // تنظيف الـ JSON أولاً
      const cleaned = this.cleanJsonResponse(response);
      
      // محاولة parse
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('❌ JSON parsing failed even after cleaning');
      console.log('Raw response (first 200 chars):', response.substring(0, 200));
      console.log('Cleaned response (first 200 chars):', this.cleanJsonResponse(response).substring(0, 200));
      
      // Return empty object as fallback
      return {};
    }
  }
  
  /**
   * Calculate cost for API usage
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // per 1K tokens
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-3-small': { input: 0.00002, output: 0 },
    };
    
    const modelPrices = prices[model] || prices['gpt-4o-mini'];
    const cost = (inputTokens * modelPrices.input + outputTokens * modelPrices.output) / 1000;
    
    this.totalCost += cost;
    
    // Check monthly limit
    if (this.totalCost > AI_CONFIG.MONTHLY_LIMIT) {
      console.warn(`⚠️ Monthly limit reached: $${this.totalCost.toFixed(2)}`);
    }
    
    return cost;
  }
  
  /**
   * Generate text embedding
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    // If no client, return mock embedding
    if (!this.client) {
      return {
        embedding: Array(1536).fill(0).map(() => Math.random()),
        tokens: Math.ceil(text.length / 4),
      };
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: AI_CONFIG.EMBEDDING_MODEL,
        input: text,
      });
      
      // Calculate cost
      const tokens = response.usage?.total_tokens || 0;
      const cost = this.calculateCost(AI_CONFIG.EMBEDDING_MODEL, tokens, 0);
      console.log(`💰 Embedding cost: $${cost.toFixed(4)}`);
      
      return {
        embedding: response.data[0].embedding,
        tokens,
      };
    } catch (error: any) {
      console.error('❌ Embedding generation failed:', error.message);
      
      // Return mock on error
      return {
        embedding: Array(1536).fill(0).map(() => Math.random()),
        tokens: Math.ceil(text.length / 4),
      };
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    const batchSize = 100;
    const results: EmbeddingResponse[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      if (!this.client) {
        // Mock embeddings
        results.push(...batch.map(text => ({
          embedding: Array(1536).fill(0).map(() => Math.random()),
          tokens: Math.ceil(text.length / 4),
        })));
        continue;
      }
      
      try {
        const response = await this.client.embeddings.create({
          model: AI_CONFIG.EMBEDDING_MODEL,
          input: batch,
        });
        
        results.push(...response.data.map((item, idx) => ({
          embedding: item.embedding,
          tokens: Math.floor((batch[idx]?.length || 0) / 4),
        })));
        
      } catch (error: any) {
        console.error('❌ Batch embedding failed:', error.message);
        // Add mock embeddings for failed batch
        results.push(...batch.map(text => ({
          embedding: Array(1536).fill(0).map(() => Math.random()),
          tokens: Math.ceil(text.length / 4),
        })));
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
    // If no client, check if we should mock
    if (!this.client) {
      return this.getMockResponse(messages[messages.length - 1].content);
    }
    
    try {
      // Count input tokens
      const inputTokens = messages.reduce((sum, msg) => 
        sum + this.countTokens(msg.content), 0
      );
      
      const response = await this.client.chat.completions.create({
        model: AI_CONFIG.MODEL,
        messages,
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
      });
      
      const content = response.choices[0]?.message?.content || '';
      const outputTokens = this.countTokens(content);
      
      // Calculate and log cost
      const cost = this.calculateCost(AI_CONFIG.MODEL, inputTokens, outputTokens);
      console.log(`💰 Chat cost: $${cost.toFixed(4)} | Total: $${this.totalCost.toFixed(2)}`);
      
      return content;
    } catch (error: any) {
      console.error('❌ Chat completion failed:', error.message);
      
      // Fallback to mock response
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
        messages,
        temperature: options.temperature ?? AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens ?? AI_CONFIG.MAX_TOKENS,
        stream: true,
      });
      
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || '';
      }
    } catch (error: any) {
      console.error('❌ Chat stream failed:', error.message);
      yield this.getMockResponse(messages[messages.length - 1].content);
    }
  }
  
  /**
   * Generate structured output with better error handling
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    const systemPrompt = `أنت مساعد ذكي يرد دائماً بـ JSON صالح.
إجابتك يجب أن تطابق هذا الـ schema بالضبط:
${JSON.stringify(schema._def, null, 2)}

رد فقط بـ JSON صالح، بدون أي نص إضافي أو markdown.`;
    
    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { ...options, temperature: 0.3 }
    );
    
    // Clean response from markdown if exists
    const cleanResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    try {
      const parsed = JSON.parse(cleanResponse);
      return schema.parse(parsed);
    } catch (error) {
      console.error('❌ Failed to parse structured response:', error);
      // Return a default based on schema
      throw new Error('Invalid structured response from AI');
    }
  }
  
  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    if (!this.encoder) {
      // Rough estimate for Arabic: 1 token ≈ 3 characters
      return Math.ceil(text.length / 3);
    }
    
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch {
      return Math.ceil(text.length / 3);
    }
  }
  
  /**
   * Split text into chunks by token count
   */
  splitTextByTokens(text: string, maxTokens: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]\s+/);
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
   * Get mock response for testing
   */
  private getMockResponse(message: string): string {
    const mockResponses: Record<string, string> = {
      'الأعداد': 'الأعداد الطبيعية هي الأعداد التي نستخدمها في العد: 1، 2، 3، 4، وهكذا.',
      'الكسور': 'الكسر هو جزء من الكل، مثل 1/2 (نصف) أو 1/4 (ربع).',
      'الضرب': 'الضرب هو جمع متكرر. مثلاً: 3 × 4 يعني 3 + 3 + 3 + 3 = 12',
      'default': 'شكراً لسؤالك! أنا في وضع التجربة حالياً. يُرجى إضافة OpenAI API key للحصول على إجابات كاملة.',
    };
    
    // Find matching response
    for (const [key, value] of Object.entries(mockResponses)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    return mockResponses.default;
  }
  
  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      totalCost: this.totalCost.toFixed(2),
      monthlyLimit: AI_CONFIG.MONTHLY_LIMIT,
      remainingBudget: (AI_CONFIG.MONTHLY_LIMIT - this.totalCost).toFixed(2),
      model: AI_CONFIG.MODEL,
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();