import type { ResourceConfig, Operation, AnyResourceConfig } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import type { ApiResponse, ListResponse } from './types.js';
import type { HttpClient } from './read-only-repository.js';
import { deserialize, serializeForCreate, serializeForUpdate } from '../serializer.js';

// Individual method interfaces
export interface HasList<T> {
  list(params?: QueryParams): Promise<ListResponse<T>>;
}

export interface HasFind<T> {
  find(id: string, params?: QueryParams): Promise<ApiResponse<T>>;
}

export interface HasSingletonFind<T> {
  find(params?: QueryParams): Promise<ApiResponse<T>>;
}

export interface HasCreate<T, TWrite> {
  create(resource: TWrite, params?: QueryParams): Promise<ApiResponse<T>>;
}

export interface HasUpdate<T, TWrite> {
  update(resource: TWrite & { id: string }, params?: QueryParams): Promise<ApiResponse<T>>;
}

export interface HasRemove {
  remove(id: string): Promise<void>;
}

// Map operation strings to their method interfaces
type OperationMethodMap<T, TWrite, Singleton extends boolean> = {
  list: HasList<T>;
  find: Singleton extends true ? HasSingletonFind<T> : HasFind<T>;
  create: HasCreate<T, TWrite>;
  update: HasUpdate<T, TWrite>;
  remove: HasRemove;
};

// Standard utility type
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// Build the intersection type from an operations tuple
export type RepositoryFor<
  T,
  TWrite,
  Ops extends readonly Operation[],
  Singleton extends boolean = false,
> = UnionToIntersection<
  {
    [K in keyof Ops]: Ops[K] extends Operation ? OperationMethodMap<T, TWrite, Singleton>[Ops[K]] : never;
  }[keyof Ops & number]
>;

/**
 * Infer the operations tuple type from a ResourceConfig value.
 * This allows `createRepository` to automatically derive the correct
 * `RepositoryFor<...>` return type without requiring the caller to
 * manually specify the operations generic parameter.
 */
type InferOps<C> = C extends { operations: infer Ops extends readonly Operation[] } ? Ops : never;

/**
 * Infer whether a ResourceConfig represents a singleton resource.
 */
type InferSingleton<C> = C extends { singleton: true } ? true : false;

export class BaseRepository<T, TWrite = Record<string, unknown>> {
  constructor(
    protected readonly client: HttpClient,
    protected readonly meta: AnyResourceConfig,
  ) {}

  private assertOperation(op: Operation): void {
    if (!this.meta.operations.includes(op)) {
      throw new Error(
        `Operation '${op}' is not supported on resource '${this.meta.type}'. Allowed operations: ${this.meta.operations.join(', ')}`,
      );
    }
  }

  async list(params?: QueryParams): Promise<ListResponse<T>> {
    this.assertOperation('list');
    const body = await this.client.get(this.meta.path, params);
    return this.deserializeList(body);
  }

  async find(idOrParams?: string | QueryParams, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('find');
    if (this.meta.singleton) {
      const body = await this.client.get(this.meta.path, idOrParams as QueryParams);
      return this.deserializeSingle(body);
    }
    const body = await this.client.get(`${this.meta.path}/${idOrParams as string}`, params);
    return this.deserializeSingle(body);
  }

  async create(resource: TWrite, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('create');
    const body = serializeForCreate(this.meta as unknown as ResourceConfig<T, TWrite>, resource);
    const response = await this.client.post(this.meta.path, body, params);
    return this.deserializeSingle(response);
  }

  async update(resource: TWrite & { id: string }, params?: QueryParams): Promise<ApiResponse<T>> {
    this.assertOperation('update');
    const body = serializeForUpdate(this.meta as unknown as ResourceConfig<T, TWrite>, resource);
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

export function createRepository<
  T,
  TWrite = Record<string, unknown>,
  const C extends ResourceConfig<T, TWrite> = ResourceConfig<T, TWrite>,
>(client: HttpClient, meta: C): RepositoryFor<T, TWrite, InferOps<C>, InferSingleton<C>> {
  return new BaseRepository<T, TWrite>(client, meta) as unknown as RepositoryFor<
    T,
    TWrite,
    InferOps<C>,
    InferSingleton<C>
  >;
}
