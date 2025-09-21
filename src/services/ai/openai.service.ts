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

// Service class
export class OpenAIService {
  private client: OpenAI | null = null;
  private encoder: any;
  
  constructor() {
    // Initialize OpenAI client only if API key exists
    if (config.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
      console.log('✅ OpenAI client initialized');
    } else {
      console.warn('⚠️ OpenAI API key not configured - using mock mode');
    }
    
    // Initialize tokenizer
    try {
      this.encoder = encoding_for_model('gpt-3.5-turbo');
    } catch {
      console.warn('⚠️ Tokenizer initialization failed');
    }
  }
  
  /**
   * Generate text embedding
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    // If no client, return mock embedding for testing
    if (!this.client) {
      return {
        embedding: Array(1536).fill(0).map(() => Math.random()),
        tokens: text.length / 4, // Rough estimate
      };
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      
      return {
        embedding: response.data[0].embedding,
        tokens: response.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    // Batch process for efficiency
    const batchSize = 100;
    const results: EmbeddingResponse[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      if (!this.client) {
        // Mock embeddings for testing
        results.push(...batch.map(text => ({
          embedding: Array(1536).fill(0).map(() => Math.random()),
          tokens: text.length / 4,
        })));
        continue;
      }
      
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
        });
        
        results.push(...response.data.map((item, idx) => ({
          embedding: item.embedding,
          tokens: Math.floor((batch[idx]?.length || 0) / 4),
        })));
        
      } catch (error) {
        console.error('Batch embedding failed:', error);
        throw error;
      }
    }
    
    return results;
  }
  
  /**
   * Chat completion
   */
  async chat(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<string> {
    // If no client, return mock response for testing
    if (!this.client) {
      return 'هذه رسالة تجريبية. يرجى إضافة OpenAI API key للحصول على إجابات حقيقية.';
    }
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Chat completion failed:', error);
      throw error;
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
      yield 'هذه رسالة تجريبية. يرجى إضافة OpenAI API key.';
      return;
    }
    
    try {
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: true,
      });
      
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || '';
      }
    } catch (error) {
      console.error('Chat stream failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate structured output
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    const systemPrompt = `You are a helpful assistant that always responds with valid JSON.
Your response must match the following schema:
${JSON.stringify(schema._def, null, 2)}

Respond ONLY with valid JSON, no additional text.`;
    
    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { ...options, temperature: 0.3 }
    );
    
    // Parse and validate response
    try {
      const parsed = JSON.parse(response);
      return schema.parse(parsed);
    } catch (error) {
      console.error('Failed to parse structured response:', error);
      throw new Error('Invalid structured response from AI');
    }
  }
  
  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    if (!this.encoder) {
      // Rough estimate: 1 token ≈ 4 characters
      return Math.ceil(text.length / 4);
    }
    
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch {
      return Math.ceil(text.length / 4);
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
}

// Export singleton instance
export const openAIService = new OpenAIService();