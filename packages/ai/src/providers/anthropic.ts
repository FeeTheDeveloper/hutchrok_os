/**
 * Anthropic / Claude Provider Adapter
 * Install: pnpm add @anthropic-ai/sdk --filter @hutchrok-os/ai
 */

import type {
  AIProvider,
  AITextRequest,
  AITextResponse,
  AIStructuredOutputRequest,
  AIStructuredOutputResponse,
} from '../gateway/index.js';
import { z } from 'zod';
import { requireEnv } from '@hutchrok-os/shared';

export class AnthropicProvider implements AIProvider {
  id = 'anthropic' as const;

  supportedCapabilities = [
    'generateText',
    'generateStructuredOutput',
    'reason',
    'classify',
    'extract',
    'summarize',
    'analyzeImage',
    'analyzeDocument',
  ] as const;

  private get apiKey(): string {
    return requireEnv('ANTHROPIC_API_KEY');
  }

  async generateText(req: AITextRequest): Promise<AITextResponse> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });
    const start = Date.now();

    const userContent = req.context
      ? `Context:\n${req.context}\n\n${req.userPrompt}`
      : req.userPrompt;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: req.maxTokens ?? 4096,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const content = response.content[0];
    const text = content && content.type === 'text' ? content.text : '';

    return {
      text,
      providerId: 'anthropic',
      modelId: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      correlationId: req.correlationId,
      durationMs: Date.now() - start,
    };
  }

  async generateStructuredOutput<T>(
    req: AIStructuredOutputRequest<z.ZodType<T>>
  ): Promise<AIStructuredOutputResponse<T>> {
    const text = await this.generateText({
      ...req,
      capability: 'generateText',
      userPrompt: `${req.userPrompt}\n\nRespond with valid JSON only. No explanation.`,
    });

    const parsed = JSON.parse(text.text) as unknown;
    const validated = req.schema.parse(parsed);

    return {
      data: validated,
      providerId: 'anthropic',
      modelId: text.modelId,
      usage: text.usage,
      correlationId: req.correlationId,
    };
  }
}
