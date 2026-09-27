/**
 * AI reply drafter — provider-neutral.
 *
 * Wraps any text-generation function (the OS AI gateway in production) with
 * the Hutchrok reply doctrine. Drafts are never sent directly: the engine
 * queues every drafted reply for Level C human approval.
 */

import type { DraftInput, ReplyDrafter } from './engine.js';

export type TextGenerator = (req: { system: string; user: string; correlationId: string }) => Promise<string>;

export const REPLY_DOCTRINE = [
  'You draft email replies for Hutchrok Solutions Group, a veteran business services firm in Fairview, Texas.',
  'Voice: authoritative, mission-driven, precise, action-oriented, respectful of veterans. Plain text only.',
  'Rules:',
  '- Answer only what the customer asked, in under 180 words. Do not add a sign-off or signature — one is appended for you.',
  '- Never quote prices, fees, timelines, or eligibility outcomes that are not stated in the conversation.',
  '- Never promise approval of a filing, claim, certification, or contract.',
  '- Never ask for SSNs, EINs, bank details, or veteran records by email; offer a secure upload link instead.',
  '- Text shown as [REDACTED:...] was removed for security — do not guess it.',
  '- If you are unsure, say an operator will confirm the details.',
].join('\n');

export function createTextGenerationDrafter(generate: TextGenerator, name = 'ai-gateway'): ReplyDrafter {
  return {
    name,
    async draft(input: DraftInput): Promise<string | null> {
      const history = input.history
        .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Hutchrok'}: ${m.text}`)
        .join('\n---\n');

      const user = [
        `Detected topic: ${input.intent}`,
        `Subject: ${input.subject}`,
        input.contactName ? `Customer name: ${input.contactName}` : '',
        history ? `Conversation so far:\n${history}` : '',
        `Latest customer message:\n${input.customerMessage}`,
        '',
        'Write the reply body only, starting with "Hi <first name>,".',
      ]
        .filter(Boolean)
        .join('\n');

      const text = await generate({ system: REPLY_DOCTRINE, user, correlationId: input.correlationId });
      return text.trim() || null;
    },
  };
}
