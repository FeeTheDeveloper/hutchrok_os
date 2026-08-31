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
import { hutchrokKernel } from '../../../config/business/hutchrok.kernel.js';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';
import { webhooksRouter } from './webhooks/index.js';

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

serve({ fetch: app.fetch, port }, () => {
  console.log(`[Hutchrok OS API] Running on port ${port}`);
  console.log(`[Hutchrok OS API] Environment: ${process.env['APP_ENV'] ?? 'local'}`);
});

export { app };
