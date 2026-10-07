/**
 * Hutchrok OS — Activity Kernel
 *
 * The typed boundary between the outside world and any agent action.
 * Section 4's canonical pipeline runs on these four primitives:
 *
 *   RECEIVE/NORMALIZE → ProviderReceiptService (idempotency, replay)
 *   ASSIGN/ACT/VERIFY → AssignmentService (one owner, evidence-gated completion)
 *   SCHEDULE          → ScheduleService (leased, idempotent follow-ups)
 *   failure of any    → ExceptionQueue (visible state, never false completion)
 *
 * The ActivityEnvelope itself lives in `@hutchrok-os/events` as an extension
 * of EventEnvelope, so every existing producer and consumer keeps working.
 */

export * from './receipts.js';
export * from './assignments.js';
export * from './exceptions.js';
export * from './schedules.js';
