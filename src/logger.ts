/**
 * Where the SDK reports what happens around access tokens; every method is
 * optional and is called as `(message, details?)`. `console` and winston fit
 * as they are; a logger whose methods take `(details, message)`, such as pino,
 * needs an adapter (see README, Logging). Messages never carry the API key, a
 * token, headers or bodies. A logger that throws or rejects never fails a call.
 */
export interface DidwwLogger {
  debug?(message: string, details?: Record<string, unknown>): unknown;
  info?(message: string, details?: Record<string, unknown>): unknown;
  warn?(message: string, details?: Record<string, unknown>): unknown;
  error?(message: string, details?: Record<string, unknown>): unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

export const SILENT_LOGGER: DidwwLogger = Object.freeze({});

export function isLogger(value: unknown): value is DidwwLogger {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return LEVELS.some((level) => typeof candidate[level] === 'function');
}

export function safeLog(
  logger: DidwwLogger,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    const method = logger[level];
    if (typeof method !== 'function') return;
    const result = details === undefined ? method.call(logger, message) : method.call(logger, message, details);
    if (result !== null && typeof result === 'object' && typeof (result as PromiseLike<unknown>).then === 'function') {
      (result as PromiseLike<unknown>).then(undefined, () => undefined);
    }
  } catch {
    // A failing logger never fails the call.
  }
}
