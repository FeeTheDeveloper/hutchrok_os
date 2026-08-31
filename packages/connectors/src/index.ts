/**
 * Hutchrok OS — Connector Interfaces
 *
 * Provider-neutral connector contracts.
 * Implement adapters for specific providers (Twilio, Telnyx, etc.)
 * without coupling the business domain to any single vendor.
 */

// ─────────────────────────────────────────
// COMMUNICATIONS CONNECTOR
// ─────────────────────────────────────────

export interface SendMessageOptions {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  correlationId?: string;
}

export interface MessageResult {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

export interface CallOptions {
  to: string;
  from?: string;
  callbackUrl?: string;
  correlationId?: string;
}

export interface CallResult {
  callId: string;
  status: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  durationSeconds: number;
}

export interface CommunicationsConnector {
  readonly provider: string;
  sendSms(opts: SendMessageOptions): Promise<MessageResult>;
  sendMms(opts: SendMessageOptions): Promise<MessageResult>;
  initiateCall(opts: CallOptions): Promise<CallResult>;
  transcribeRecording(recordingUrl: string): Promise<TranscriptionResult>;
}

// ─────────────────────────────────────────
// PAYMENTS CONNECTOR
// ─────────────────────────────────────────

export interface CreateInvoiceOptions {
  customerId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  daysUntilDue?: number;
  metadata?: Record<string, string>;
}

export interface CreatePaymentLinkOptions {
  amountCents: number;
  currency?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentsConnector {
  readonly provider: string;
  createInvoice(opts: CreateInvoiceOptions): Promise<{ invoiceId: string; hostedUrl?: string }>;
  createPaymentLink(opts: CreatePaymentLinkOptions): Promise<{ url: string; linkId: string }>;
  refundPayment(paymentId: string, amountCents?: number): Promise<{ refundId: string }>;
}

// ─────────────────────────────────────────
// GOOGLE WORKSPACE CONNECTOR
// ─────────────────────────────────────────

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  receivedAt: string;
  attachments?: Array<{ name: string; mimeType: string; size: number; driveFileId?: string }>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  attendees?: string[];
  meetLink?: string;
}

export interface GoogleWorkspaceConnector {
  readonly domain: string;

  // Gmail
  listUnreadMessages(userId?: string): Promise<EmailMessage[]>;
  getMessage(messageId: string, userId?: string): Promise<EmailMessage>;
  sendEmail(opts: { to: string[]; subject: string; body: string; userId?: string }): Promise<{ messageId: string }>;

  // Calendar
  listUpcomingEvents(userId?: string, maxResults?: number): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, 'id'>, userId?: string): Promise<CalendarEvent>;

  // Drive
  getFile(fileId: string): Promise<{ name: string; mimeType: string; downloadUrl?: string }>;
}

// ─────────────────────────────────────────
// WEBSITE INGESTION CONNECTOR
// ─────────────────────────────────────────

export interface WebsiteEventPayload {
  eventType: string;
  sessionId?: string;
  page?: string;
  referrer?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
  signature?: string; // HMAC signature for validation
  timestamp?: string;
}

export interface WebsiteIngestionConnector {
  validateSignature(payload: string, signature: string): boolean;
  ingest(event: WebsiteEventPayload): Promise<{ eventId: string }>;
}

// ─────────────────────────────────────────
// MOCK COMMUNICATIONS CONNECTOR
// ─────────────────────────────────────────

export class MockCommunicationsConnector implements CommunicationsConnector {
  readonly provider = 'mock';

  async sendSms(opts: SendMessageOptions): Promise<MessageResult> {
    console.log(`[MOCK SMS] To: ${opts.to} | Body: ${opts.body}`);
    return { messageId: `mock_sms_${Date.now()}`, status: 'sent' };
  }

  async sendMms(opts: SendMessageOptions): Promise<MessageResult> {
    console.log(`[MOCK MMS] To: ${opts.to} | Body: ${opts.body}`);
    return { messageId: `mock_mms_${Date.now()}`, status: 'sent' };
  }

  async initiateCall(opts: CallOptions): Promise<CallResult> {
    console.log(`[MOCK CALL] To: ${opts.to}`);
    return { callId: `mock_call_${Date.now()}`, status: 'initiated' };
  }

  async transcribeRecording(_recordingUrl: string): Promise<TranscriptionResult> {
    return { text: '[MOCK TRANSCRIPTION]', confidence: 1.0, durationSeconds: 0 };
  }
}
