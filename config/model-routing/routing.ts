/**
 * Hutchrok Model Routing Configuration
 *
 * Maps model profiles and capabilities to AI providers.
 * Change this file to reroute capabilities without touching application code.
 */

import type { ModelRoutingRule } from '@hutchrok-os/ai';

export const modelRoutingRules: ModelRoutingRule[] = [
  // Engineering / deep reasoning → Anthropic
  { profile: 'engineering_builder', providerId: 'anthropic' },
  { profile: 'deep_reasoning', providerId: 'anthropic' },

  // Fast conversation → OpenAI
  { profile: 'fast_conversation', providerId: 'openai' },

  // Document analysis → Anthropic
  { profile: 'document_analysis', providerId: 'anthropic' },

  // Structured extraction → OpenAI
  { profile: 'structured_extraction', providerId: 'openai' },

  // Classification low cost → OpenAI
  { profile: 'classification_low_cost', providerId: 'openai' },

  // Workspace assistant → OpenAI
  { profile: 'workspace_assistant', providerId: 'openai' },

  // Creative image → OpenAI (DALL-E)
  { profile: 'creative_image', providerId: 'openai', modelId: 'dall-e-3' },

  // Creative video → Higgsfield (when enabled)
  { profile: 'creative_video', providerId: 'higgsfield' },

  // Capability-level fallbacks
  { capability: 'embed', providerId: 'openai' },
  { capability: 'transcribe', providerId: 'openai' },
  { capability: 'synthesizeVoice', providerId: 'openai' },
  { capability: 'generateImage', providerId: 'openai' },
  { capability: 'generateVideo', providerId: 'higgsfield' },
];

export const modelRoutingFallback = 'openai' as const;
