import type { AnyResourceConfig } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import { BaseRepository } from './base-repository.js';

export interface HttpClient {
  get(path: string, params?: QueryParams): Promise<unknown>;
  post(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  patch(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  delete(path: string): Promise<void>;
}

export class ReadOnlyRepository<T, TWrite = Record<string, unknown>> extends BaseRepository<T, TWrite> {
  constructor(client: HttpClient, meta: AnyResourceConfig) {
    super(client, { ...meta, operations: ['list', 'find'] as const });
  }
}
