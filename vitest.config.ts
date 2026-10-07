import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@hutchrok-os/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@hutchrok-os/kernel': resolve(__dirname, 'packages/kernel/src/index.ts'),
      '@hutchrok-os/domain': resolve(__dirname, 'packages/domain/src/index.ts'),
      '@hutchrok-os/events': resolve(__dirname, 'packages/events/src/index.ts'),
      '@hutchrok-os/audit': resolve(__dirname, 'packages/audit/src/index.ts'),
      '@hutchrok-os/policies': resolve(__dirname, 'packages/policies/src/index.ts'),
      '@hutchrok-os/approvals': resolve(__dirname, 'packages/approvals/src/index.ts'),
      '@hutchrok-os/ai': resolve(__dirname, 'packages/ai/src/index.ts'),
      '@hutchrok-os/agents': resolve(__dirname, 'packages/agents/src/index.ts'),
      '@hutchrok-os/mcp': resolve(__dirname, 'packages/mcp/src/index.ts'),
      '@hutchrok-os/connectors': resolve(__dirname, 'packages/connectors/src/index.ts'),
      '@hutchrok-os/autopilot': resolve(__dirname, 'packages/autopilot/src/index.ts'),
      '@hutchrok-os/activity': resolve(__dirname, 'packages/activity/src/index.ts'),
      '@hutchrok-os/config/kernel': resolve(__dirname, 'config/business/hutchrok.kernel.ts'),
      '@hutchrok-os/db/stores': resolve(__dirname, 'infrastructure/stores/index.ts'),
      '@hutchrok-os/db': resolve(__dirname, 'infrastructure/database/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/dist/**'],
    },
  },
});
