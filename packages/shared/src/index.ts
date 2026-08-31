/**
 * Hutchrok OS — Shared Utilities
 */

import { randomUUID } from 'crypto';

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

export function generateId(): string {
  return randomUUID();
}

export function generateCorrelationId(): string {
  return `corr_${randomUUID().replace(/-/g, '')}`;
}

export function generateCausationId(): string {
  return `caus_${randomUUID().replace(/-/g, '')}`;
}

// ─────────────────────────────────────────
// TIMESTAMPS
// ─────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────
// TYPE UTILITIES
// ─────────────────────────────────────────

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Result<T, E = Error> {
  ok: boolean;
  data?: T;
  error?: E;
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────

export type Environment = 'local' | 'dev' | 'preview' | 'staging' | 'production';

export function getEnvironment(): Environment {
  const env = process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'local';
  const valid: Environment[] = ['local', 'dev', 'preview', 'staging', 'production'];
  if (valid.includes(env as Environment)) return env as Environment;
  return 'local';
}

export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

// ─────────────────────────────────────────
// REQUIRED ENV HELPER
// ─────────────────────────────────────────

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable "${key}" is not set.`);
  }
  return value;
}

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}
