/**
 * OpenAI Provider Adapter
 * Install: pnpm add openai --filter @hutchrok-os/ai
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
import { requireEnv } from '@hutchrok-os/shared';

export class OpenAIProvider implements AIProvider {
  id = 'openai' as const;

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
    'synthesizeVoice',
  ] as const;

  private get apiKey(): string {
    return requireEnv('OPENAI_API_KEY');
  }

  async generateText(req: AITextRequest): Promise<AITextResponse> {
    // Dynamic import allows the openai package to be optional at compile time
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });
    const start = Date.now();

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    if (req.context) messages.push({ role: 'user', content: `Context:\n${req.context}` });
    messages.push({ role: 'user', content: req.userPrompt });

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('OpenAI returned no choices.');

    return {
      text: choice.message.content ?? '',
      providerId: 'openai',
      modelId: response.model,
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
        : undefined,
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
      providerId: 'openai',
      modelId: text.modelId,
      usage: text.usage,
      correlationId: req.correlationId,
    };
  }

  async embed(req: AIEmbedRequest): Promise<AIEmbedResponse> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: req.texts,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      providerId: 'openai',
      modelId: 'text-embedding-3-small',
      correlationId: req.correlationId,
    };
  }

  async generateImage(req: AIImageRequest): Promise<AIImageResponse> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: req.prompt,
      size: (req.size as Parameters<typeof client.images.generate>[0]['size']) ?? '1024x1024',
      quality: (req.quality as Parameters<typeof client.images.generate>[0]['quality']) ?? 'standard',
    });

    return {
      urls: response.data.map((d) => d.url ?? '').filter(Boolean),
      providerId: 'openai',
      modelId: 'dall-e-3',
      correlationId: req.correlationId,
    };
  }
}
