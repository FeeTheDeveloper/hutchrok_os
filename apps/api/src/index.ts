/**
 * Hutchrok OS — API Server Entry Point
 *
 * Bootstraps the company kernel, connects the database,
 * registers routes, and starts the server.
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { loadKernel } from '@hutchrok-os/kernel';
import { hutchrokKernel } from '@hutchrok-os/config/kernel';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';
import { webhooksRouter } from './webhooks/index.js';
import { emailWebhooksRouter } from './webhooks/email.js';
import { siteRouter } from './routes/site.js';
import { autopilotRouter } from './routes/autopilot.js';
import { startBeat } from './autopilot.js';

// ─────────────────────────────────────────
// Bootstrap Company Kernel
// ─────────────────────────────────────────
loadKernel(hutchrokKernel);

// ─────────────────────────────────────────
// App
// ─────────────────────────────────────────
const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors({
  origin: process.env['API_ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}));

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────
app.route('/health', healthRouter);
app.route('/api/v1/events', eventsRouter);
app.route('/api/v1/site', siteRouter);
app.route('/api/v1/autopilot', autopilotRouter);
app.route('/webhooks/email', emailWebhooksRouter);
app.route('/webhooks', webhooksRouter);

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─────────────────────────────────────────
// Start
// ─────────────────────────────────────────
const port = parseInt(process.env['API_PORT'] ?? '3001', 10);

// Durable adapters exist when DATABASE_URL is configured, but approval-to-effect
// recovery, provider reconciliation, and complete tenant binding are unfinished.
// A production process must not acknowledge work it cannot durably recover.
if (process.env['APP_ENV'] === 'production' || process.env['NODE_ENV'] === 'production') {
  throw new Error('Production startup blocked: Site Autopilot requires tenant-bound effect recovery and provider reconciliation before activation.');
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`[Hutchrok OS API] Running on port ${port}`);
  console.log(`[Hutchrok OS API] Environment: ${process.env['APP_ENV'] ?? 'local'}`);
  startBeat();
});

export { app };
