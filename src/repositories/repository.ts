import type { ResourceConfig, InferT, InferTWrite, Operation } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import type { ApiResponse, ListResponse, RepositoryFor, InferOps, InferSingleton } from './types.js';
import { deserialize, serializeForCreate, serializeForUpdate } from '../serializer.js';
import { DidwwClientError } from '../errors.js';

export interface HttpClient {
  get(path: string, params?: QueryParams): Promise<unknown>;
  post(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  patch(path: string, body: unknown, params?: QueryParams): Promise<unknown>;
  delete(path: string): Promise<void>;
}

export class Repository<T, TWrite = Record<string, unknown>> {
  constructor(
    protected readonly client: HttpClient,
    protected readonly meta: ResourceConfig<T, TWrite>,
  ) {}

  private assertOperation(op: Operation): void {
    if (!this.meta.operations.includes(op)) {
      throw new DidwwClientError(
        `Operation '${op}' is not supported on resource '${this.meta.type}'. Allowed operations: ${this.meta.operations.join(', ')}`,
      );
    }
  }

  async list(params?: QueryParams): Promise<ListResponse<T>> {
    this.assertOperation('list');
    const body = await this.client.get(this.meta.path, params);
    return this.deserializeList(body);
  }

  async find(id: string, params?: QueryParams): Promise<ApiResponse<T>>;
  async find(params?: QueryParams): Promise<ApiResponse<T>>;
  async find(idOrParams?: string | QueryParams, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('find');
    if (this.meta.singleton) {
      const body = await this.client.get(this.meta.path, idOrParams as QueryParams);
      return this.deserializeSingle(body);
    }
    if (typeof idOrParams !== 'string' || idOrParams.trim() === '') {
      throw new DidwwClientError(
        `find() on non-singleton resource '${this.meta.type}' requires a non-empty string id as the first argument`,
      );
    }
    const body = await this.client.get(`${this.meta.path}/${idOrParams}`, params);
    return this.deserializeSingle(body);
  }

  async create(resource: TWrite, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('create');
    const body = serializeForCreate(this.meta, resource);
    const response = await this.client.post(this.meta.path, body, params);
    return this.deserializeSingle(response);
  }

  async update(resource: TWrite & { id: string }, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('update');
    const body = serializeForUpdate(this.meta, resource);
    const response = await this.client.patch(`${this.meta.path}/${resource.id}`, body, params);
    return this.deserializeSingle(response);
  }

  async remove(id: string): Promise<void> {
    this.assertOperation('remove');
    await this.client.delete(`${this.meta.path}/${id}`);
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

export function createRepository<const C extends ResourceConfig>(
  client: HttpClient,
  meta: C,
): RepositoryFor<InferT<C>, InferTWrite<C>, InferOps<C>, InferSingleton<C>> {
  return new Repository<InferT<C>, InferTWrite<C>>(
    client,
    meta as ResourceConfig<InferT<C>, InferTWrite<C>>,
  ) as RepositoryFor<InferT<C>, InferTWrite<C>, InferOps<C>, InferSingleton<C>>;
}
