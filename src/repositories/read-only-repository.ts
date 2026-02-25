import type { ResourceMeta } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import type { ApiResponse, ListResponse } from './types.js';
import { deserialize } from '../serializer.js';

export interface HttpClient {
  get(path: string, params?: QueryParams): Promise<unknown>;
  post(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  patch(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  delete(path: string): Promise<void>;
}

export class ReadOnlyRepository<T, TWrite = Record<string, unknown>> {
  constructor(
    protected readonly client: HttpClient,
    protected readonly meta: ResourceMeta<T, TWrite>,
  ) {}

  async list(params?: QueryParams): Promise<ListResponse<T>> {
    const body = await this.client.get(this.meta.path, params);
    return this.deserializeList(body);
  }

  async find(id: string, params?: QueryParams): Promise<ApiResponse<T>> {
    const body = await this.client.get(`${this.meta.path}/${id}`, params);
    return this.deserializeSingle(body);
  }

  protected deserializeSingle(body: unknown): ApiResponse<T> {
    const result = deserialize<T>(body);
    return { data: result.data as T, meta: result.meta, links: result.links };
  }

  protected deserializeList(body: unknown): ListResponse<T> {
    const result = deserialize<T>(body);
    const data = Array.isArray(result.data) ? result.data : [result.data];
    return { data, meta: result.meta, links: result.links };
  }
}
