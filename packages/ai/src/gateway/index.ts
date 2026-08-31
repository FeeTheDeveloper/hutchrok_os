/**
 * Hutchrok OS — AI Gateway
 *
 * Provider-neutral interface for all AI capabilities.
 * The application requests capabilities, not specific providers.
 * Models are interchangeable — no tight coupling to one provider.
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// AI CAPABILITIES
// ─────────────────────────────────────────

export type AICapability =
  | 'generateText'
  | 'generateStructuredOutput'
  | 'reason'
  | 'classify'
  | 'extract'
  | 'summarize'
  | 'embed'
  | 'analyzeImage'
  | 'analyzeDocument'
  | 'generateImage'
  | 'generateVideo'
  | 'transcribe'
  | 'synthesizeVoice';

// ─────────────────────────────────────────
// PROVIDER IDs
// ─────────────────────────────────────────

export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'higgsfield'
  | 'mock';

// ─────────────────────────────────────────
// MODEL PROFILES
// ─────────────────────────────────────────

export type ModelProfile =
  | 'fast_conversation'
  | 'deep_reasoning'
  | 'document_analysis'
  | 'structured_extraction'
  | 'classification_low_cost'
  | 'creative_image'
  | 'creative_video'
  | 'workspace_assistant'
  | 'engineering_builder';

// ─────────────────────────────────────────
// REQUEST / RESPONSE TYPES
// ─────────────────────────────────────────

export interface AITextRequest {
  capability: 'generateText' | 'reason' | 'summarize';
  profile?: ModelProfile;
  systemPrompt?: string;
  userPrompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  correlationId?: string;
}

export interface AITextResponse {
  text: string;
  providerId: AIProviderId;
  modelId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  correlationId?: string;
  durationMs?: number;
}

export interface AIStructuredOutputRequest<TSchema extends z.ZodType> {
  capability: 'generateStructuredOutput' | 'extract' | 'classify';
  profile?: ModelProfile;
  schema: TSchema;
  systemPrompt?: string;
  userPrompt: string;
  context?: string;
  correlationId?: string;
}

export interface AIStructuredOutputResponse<T> {
  data: T;
  providerId: AIProviderId;
  modelId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  correlationId?: string;
}

export interface AIEmbedRequest {
  capability: 'embed';
  texts: string[];
  correlationId?: string;
}

export interface AIEmbedResponse {
  embeddings: number[][];
  providerId: AIProviderId;
  modelId: string;
  correlationId?: string;
}

export interface AIImageRequest {
  capability: 'generateImage';
  profile?: ModelProfile;
  prompt: string;
  size?: string;
  quality?: string;
  correlationId?: string;
}

export interface AIImageResponse {
  urls: string[];
  providerId: AIProviderId;
  modelId: string;
  correlationId?: string;
}

// ─────────────────────────────────────────
// AI PROVIDER INTERFACE
// ─────────────────────────────────────────

export interface AIProvider {
  id: AIProviderId;
  supportedCapabilities: AICapability[];
  generateText(req: AITextRequest): Promise<AITextResponse>;
  generateStructuredOutput<T>(req: AIStructuredOutputRequest<z.ZodType<T>>): Promise<AIStructuredOutputResponse<T>>;
  embed?(req: AIEmbedRequest): Promise<AIEmbedResponse>;
  generateImage?(req: AIImageRequest): Promise<AIImageResponse>;
}

// ─────────────────────────────────────────
// AI GATEWAY
// ─────────────────────────────────────────

export class AIGateway {
  private providers: Map<AIProviderId, AIProvider> = new Map();
  private router: ModelRouter;

  constructor(router: ModelRouter) {
    this.router = router;
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  async generateText(req: AITextRequest): Promise<AITextResponse> {
    const provider = this.resolveProvider('generateText', req.profile);
    return provider.generateText(req);
  }

  async generateStructuredOutput<T>(
    req: AIStructuredOutputRequest<z.ZodType<T>>
  ): Promise<AIStructuredOutputResponse<T>> {
    const provider = this.resolveProvider('generateStructuredOutput', req.profile);
    return provider.generateStructuredOutput(req);
  }

  async embed(req: AIEmbedRequest): Promise<AIEmbedResponse> {
    const provider = this.resolveProvider('embed');
    if (!provider.embed) throw new Error(`Provider ${provider.id} does not support embed.`);
    return provider.embed(req);
  }

  async generateImage(req: AIImageRequest): Promise<AIImageResponse> {
    const provider = this.resolveProvider('generateImage', req.profile);
    if (!provider.generateImage) throw new Error(`Provider ${provider.id} does not support generateImage.`);
    return provider.generateImage(req);
  }

  private resolveProvider(capability: AICapability, profile?: ModelProfile): AIProvider {
    const providerId = this.router.route({ capability, profile });
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(
        `AI provider "${providerId}" is not registered. Available: [${[...this.providers.keys()].join(', ')}]`
      );
    }
    return provider;
  }
}

// ─────────────────────────────────────────
// MODEL ROUTER
// ─────────────────────────────────────────

export interface ModelRouterConfig {
  rules: ModelRoutingRule[];
  fallback: AIProviderId;
}

export interface ModelRoutingRule {
  capability?: AICapability;
  profile?: ModelProfile;
  providerId: AIProviderId;
  modelId?: string;
}

export class ModelRouter {
  constructor(private readonly config: ModelRouterConfig) {}

  route(context: { capability: AICapability; profile?: ModelProfile }): AIProviderId {
    for (const rule of this.config.rules) {
      const capabilityMatch = !rule.capability || rule.capability === context.capability;
      const profileMatch = !rule.profile || rule.profile === context.profile;
      if (capabilityMatch && profileMatch) {
        return rule.providerId;
      }
    }
    return this.config.fallback;
  }
}
