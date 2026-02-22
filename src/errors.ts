export interface JsonApiError {
  status?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, unknown>;
}

export class DidwwApiError extends Error {
  public readonly status: number;
  public readonly errors: JsonApiError[];
  public readonly body: unknown;

  constructor(status: number, body: unknown) {
    const errors = Array.isArray((body as any)?.errors)
      ? (body as any).errors as JsonApiError[]
      : [];
    const message = errors.length > 0
      ? errors.map(e => e.detail || e.title || 'Unknown error').join('; ')
      : `API error ${status}`;
    super(message);
    this.name = 'DidwwApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}

export class DidwwClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DidwwClientError';
  }
}
