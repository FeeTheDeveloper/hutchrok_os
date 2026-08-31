import { Hono } from 'hono';

export const webhooksRouter = new Hono();

// Stripe webhook — validate and dispatch
webhooksRouter.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }
  // TODO: Implement Stripe webhook verification and event dispatch
  return c.json({ received: true });
});

// Google Workspace push notification
webhooksRouter.post('/google-workspace', async (c) => {
  // TODO: Implement Google push notification handling
  return c.json({ received: true });
});

// Communications provider webhook (Twilio/Telnyx)
webhooksRouter.post('/communications', async (c) => {
  // TODO: Implement communications webhook routing
  return c.json({ received: true });
});

// GitHub webhook
webhooksRouter.post('/github', async (c) => {
  const signature = c.req.header('x-hub-signature-256');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  // TODO: Implement GitHub webhook verification and dispatch
  return c.json({ received: true });
});
