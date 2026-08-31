/**
 * Mock AI Provider — for local development and testing without API keys.
 */

import type {
  AIProvider,
  AITextRequest,
  AITextResponse,
  AIStructuredOutputRequest,
  AIStructuredOutputResponse,
  AIEmbedRequest,
  AIEmbedResponse,
  AIImageRequest,
  AIImageResponse,
} from '../gateway/index.js';
import { z } from 'zod';

export class MockAIProvider implements AIProvider {
  id = 'mock' as const;

  supportedCapabilities = [
    'generateText',
    'generateStructuredOutput',
    'reason',
    'classify',
    'extract',
    'summarize',
    'embed',
    'analyzeImage',
    'analyzeDocument',
    'generateImage',
    'transcribe',
  ] as const;

  async generateText(req: AITextRequest): Promise<AITextResponse> {
    return {
      text: `[MOCK] Response to: ${req.userPrompt.substring(0, 80)}...`,
      providerId: 'mock',
      modelId: 'mock-1.0',
      usage: { inputTokens: 10, outputTokens: 20 },
      correlationId: req.correlationId,
      durationMs: 50,
    };
  }

  async generateStructuredOutput<T>(
    req: AIStructuredOutputRequest<z.ZodType<T>>
  ): Promise<AIStructuredOutputResponse<T>> {
    // Parse empty object through schema to return a valid default
    const result = req.schema.safeParse({});
    if (!result.success) {
      throw new Error(`[MOCK] Cannot generate structured output for schema: ${result.error.message}`);
    }
    return {
      data: result.data,
      providerId: 'mock',
      modelId: 'mock-1.0',
      usage: { inputTokens: 10, outputTokens: 20 },
      correlationId: req.correlationId,
    };
  }

  async embed(req: AIEmbedRequest): Promise<AIEmbedResponse> {
    return {
      embeddings: req.texts.map(() => Array.from({ length: 1536 }, () => Math.random())),
      providerId: 'mock',
      modelId: 'mock-embed-1.0',
      correlationId: req.correlationId,
    };
  }

  async generateImage(req: AIImageRequest): Promise<AIImageResponse> {
    return {
      urls: ['https://placeholder.hutchrok.com/mock-image.png'],
      providerId: 'mock',
      modelId: 'mock-image-1.0',
      correlationId: req.correlationId,
    };
  }
}
