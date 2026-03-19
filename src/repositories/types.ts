import type { Operation } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface ListResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

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

export type InferOps<C> = C extends { operations: infer Ops extends readonly Operation[] } ? Ops : never;

export type InferSingleton<C> = C extends { singleton: true } ? true : false;
