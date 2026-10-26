export interface JsonApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, unknown>;
}

/** The base class of every error the SDK raises for a failed call. */
export class DidwwError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'DidwwError';
  }
}

/** The API answered with an error status (or a redirect, which is never followed). */
export class DidwwApiError extends DidwwError {
  public readonly status: number;
  public readonly errors: JsonApiError[];
  public readonly body: unknown;

  constructor(status: number, body: unknown) {
    const obj = body as Record<string, unknown> | null | undefined;
    const errors =
      obj && typeof obj === 'object' && Array.isArray(obj.errors)
        ? (obj.errors as unknown[]).filter((e): e is JsonApiError => e !== null && typeof e === 'object')
        : [];
    const message =
      errors.length > 0 ? errors.map((e) => e.detail || e.title || 'Unknown error').join('; ') : `API error ${status}`;
    super(message);
    this.name = 'DidwwApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}

/** The SDK could not make the call or could not read the answer; `cause` holds the underlying failure, if any. */
export class DidwwClientError extends DidwwError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DidwwClientError';
  }
}

/** Why an access token could not be obtained. */
export const AuthErrorKind = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  RATE_LIMITED: 'rate_limited',
  SERVER_ERROR: 'server_error',
  CONNECTION_ERROR: 'connection_error',
  INVALID_GRANT: 'invalid_grant',
  UNEXPECTED_STATUS: 'unexpected_status',
} as const;
export type AuthErrorKind = (typeof AuthErrorKind)[keyof typeof AuthErrorKind];

export interface DidwwAuthErrorInit {
  kind: AuthErrorKind;
  status?: number | null;
  error?: string | null;
  errorDescription?: string | null;
  retryAfter?: number | null;
  message?: string;
  cause?: unknown;
}

/**
 * The token service did not grant an access token.
 *
 * `status` is the HTTP status of the token service, or null when it did not
 * answer; `error` and `errorDescription` come from its answer; `retryAfter`
 * is the number of seconds to wait (`rate_limited` only).
 */
export class DidwwAuthError extends DidwwError {
  readonly kind: AuthErrorKind;
  readonly status: number | null;
  readonly error: string | null;
  readonly errorDescription: string | null;
  readonly retryAfter: number | null;

  constructor(init: DidwwAuthErrorInit) {
    const status = init.status ?? null;
    const error = init.error ?? null;
    const errorDescription = init.errorDescription ?? null;
    super(init.message ?? authMessage(status, error, errorDescription), { cause: init.cause });
    this.name = 'DidwwAuthError';
    this.kind = init.kind;
    this.status = status;
    this.error = error;
    this.errorDescription = errorDescription;
    this.retryAfter = init.retryAfter ?? null;
  }
}

function authMessage(status: number | null, error: string | null, description: string | null): string {
  if (error && description) return `Token service: ${error}: ${description}`;
  if (error || description) return `Token service: ${error || description}`;
  return `Token service responded with status ${status}`;
}

// DidwwPricesError and PricesErrorKind (the prices services) are defined below this line.

/** Why a prices service call failed. */
export const PricesErrorKind = {
  BAD_REQUEST: 'bad_request',
  NOT_AUTHORIZED: 'not_authorized',
  ACCESS_DENIED: 'access_denied',
  PRICE_PLAN_NOT_ASSIGNED: 'price_plan_not_assigned',
  PRICE_NOT_FOUND: 'price_not_found',
  NOT_ACCEPTABLE: 'not_acceptable',
  TOO_MANY_REQUESTS: 'too_many_requests',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  UNEXPECTED_STATUS: 'unexpected_status',
  CONNECTION_ERROR: 'connection_error',
} as const;
export type PricesErrorKind = (typeof PricesErrorKind)[keyof typeof PricesErrorKind];

export interface DidwwPricesErrorInit {
  kind: PricesErrorKind;
  status?: number | null;
  code?: string | null;
  errors?: readonly JsonApiError[];
  retryAfter?: number | null;
  message?: string;
  cause?: unknown;
}

/**
 * A prices service refused a call or could not be reached.
 *
 * `status` is the HTTP status of the answer, or null when there was none;
 * `code` is the `code` of the first error object (a 404 without one reports
 * `price_plan_not_assigned`); `errors` holds the error objects of the answer;
 * `retryAfter` is its Retry-After in seconds, when given in seconds.
 */
export class DidwwPricesError extends DidwwError {
  readonly kind: PricesErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly errors: readonly JsonApiError[];
  readonly retryAfter: number | null;

  constructor(init: DidwwPricesErrorInit) {
    const status = init.status ?? null;
    const errors = Object.freeze([...(init.errors ?? [])]);
    super(init.message ?? pricesMessage(status, errors), { cause: init.cause });
    this.name = 'DidwwPricesError';
    this.kind = init.kind;
    this.status = status;
    this.code = init.code ?? null;
    this.errors = errors;
    this.retryAfter = init.retryAfter ?? null;
  }
}

function pricesMessage(status: number | null, errors: readonly JsonApiError[]): string {
  const texts: string[] = [];
  for (const error of errors) {
    const text = [error.detail, error.title].find((v) => typeof v === 'string' && v !== '');
    if (text !== undefined) texts.push(text);
  }
  if (texts.length > 0) return `Prices service: ${texts.join('; ')}`;
  if (status !== null) return `Prices service responded with status ${status}`;
  return 'Prices service request failed';
}
