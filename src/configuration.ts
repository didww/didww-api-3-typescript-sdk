import { DidwwClientError } from './errors.js';

/** A DIDWW environment. The value is the JSON:API base URL. */
export enum Environment {
  PRODUCTION = 'https://api.didww.com/v3/',
  SANDBOX = 'https://sandbox-api.didww.com/v3/',
}

/** The API version requested for access tokens unless `apiVersion` is given. */
export const DEFAULT_API_VERSION = '2026-10-22';

/** The scope requested for access tokens. */
export const Scope = {
  READ: 'read',
  FULL: 'full',
} as const;
export type Scope = (typeof Scope)[keyof typeof Scope];

/** Token audiences: one per service host, the same names in every environment. */
export const Audience = {
  API: 'api.didww.com',
  VOICE_IN: 'api-vin.didww.com',
  VOICE_OUT: 'api-vout.didww.com',
  SMS: 'api-sms.didww.com',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

export interface EnvironmentEndpoints {
  /** The token service base URL. */
  readonly auth: string;
  readonly voiceInPrices: string;
  readonly voiceOutPrices: string;
  readonly smsPrices: string;
}

/** The token service and prices service base URLs of each environment. */
export const ENVIRONMENT_ENDPOINTS: Readonly<Record<Environment, EnvironmentEndpoints>> = Object.freeze({
  [Environment.SANDBOX]: Object.freeze({
    auth: 'https://auth-sandbox.didww.com',
    voiceInPrices: 'https://api-vin-sandbox.didww.com/v3',
    voiceOutPrices: 'https://api-vout-sandbox.didww.com/v3',
    smsPrices: 'https://api-sms-sandbox.didww.com/v3',
  }),
  [Environment.PRODUCTION]: Object.freeze({
    auth: 'https://auth.didww.com',
    voiceInPrices: 'https://api-vin.didww.com/v3',
    voiceOutPrices: 'https://api-vout.didww.com/v3',
    smsPrices: 'https://api-sms.didww.com/v3',
  }),
});

/** The largest delay `setTimeout` honours; larger ones fire at once. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

const API_KEY_RE = /^[\x21-\x7e]+$/;
const API_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_URL_RE = /^https?:\/\/[^/@]+(?:\/.*)?$/i;

export function validateApiKey(apiKey: unknown): string {
  if (typeof apiKey !== 'string' || apiKey === '') {
    throw new DidwwClientError('apiKey is required');
  }
  if (!API_KEY_RE.test(apiKey)) {
    throw new DidwwClientError('apiKey contains characters not allowed in an HTTP header');
  }
  return apiKey;
}

export function validateEnvironment(environment: unknown): Environment {
  if (!Object.values(Environment).includes(environment as Environment)) {
    throw new DidwwClientError('environment must be Environment.SANDBOX or Environment.PRODUCTION');
  }
  return environment as Environment;
}

export function validateApiVersion(apiVersion: unknown): string {
  if (typeof apiVersion !== 'string' || !API_VERSION_RE.test(apiVersion)) {
    throw new DidwwClientError(`API version must be a YYYY-MM-DD date, got ${describe(apiVersion)}`);
  }
  if (apiVersion < DEFAULT_API_VERSION) {
    throw new DidwwClientError(
      `API version ${apiVersion} is not supported: this SDK requires ${DEFAULT_API_VERSION} or later;` +
        ` use @didww/sdk 3.x (branch release-3) for 2026-04-16`,
    );
  }
  return apiVersion;
}

export function validateScope(scope: unknown): Scope | null {
  if (scope === undefined || scope === null) return null;
  if (scope === Scope.READ || scope === Scope.FULL) return scope;
  throw new DidwwClientError("scope must be 'read' or 'full'");
}

/**
 * Checks a service base URL: http or https with a host, and no user info,
 * query, fragment, backslash, whitespace or control character. The raw string
 * is checked, because the URL parser silently drops or rewrites some of these.
 */
export function isServiceUrl(url: unknown): url is string {
  if (typeof url !== 'string' || /[\u0000- \u007f\\?#]/.test(url) || !SERVICE_URL_RE.test(url)) {
    return false;
  }
  try {
    return new URL(url).hostname !== '';
  } catch {
    return false;
  }
}

export function validateServiceUrl(name: string, url: unknown): string {
  if (!isServiceUrl(url)) {
    throw new DidwwClientError(
      `${name} URL must be an http or https URL without a query or fragment, got ${shownUrl(url)}`,
    );
  }
  return url;
}

function shownUrl(url: unknown): string {
  if (typeof url !== 'string') return typeof url;
  return url.includes('@') ? 'a URL with user info' : JSON.stringify(url);
}

export function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/** A timeout in milliseconds; `undefined` gives the default, `null` turns the limit off. */
export function validateTimeout(name: string, value: unknown, defaultMs: number | null): number | null {
  if (value === undefined) return defaultMs;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_TIMEOUT_MS) {
    throw new DidwwClientError(`${name} must be a positive number of milliseconds up to ${MAX_TIMEOUT_MS} or null`);
  }
  return value;
}

function describe(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : typeof value;
}
