import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'hutchrok-os-api',
    timestamp: new Date().toISOString(),
    environment: process.env['APP_ENV'] ?? 'local',
  });
});

healthRouter.get('/live', (c) => c.json({ status: 'live' }));
healthRouter.get('/ready', (c) => c.json({ status: 'ready' }));
