export interface ResourceRef {
  id: string;
  type: string;
}

export type Operation = 'list' | 'find' | 'create' | 'update' | 'remove';

export interface TypeBrand<T, TWrite> {
  /** @internal phantom brand — do not use directly */
  readonly __phantom?: { readonly T: T; readonly TWrite: TWrite };
}

export interface ResourceConfig<T = Record<string, unknown>, TWrite = Record<string, unknown>> {
  readonly type: string;
  readonly path: string;
  readonly writableKeys: readonly (string & keyof TWrite)[];
  readonly relationshipKeys?: readonly (string & keyof TWrite)[];
  readonly serializeCustom?: (data: TWrite, method: 'POST' | 'PATCH') => Record<string, unknown>;
  readonly deserializeCustom?: (data: Record<string, unknown>) => Partial<T>;
  readonly operations: readonly Operation[];
  readonly singleton?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type InferT<C> = C extends TypeBrand<infer T, infer _TW> ? T : Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type InferTWrite<C> = C extends TypeBrand<infer _T, infer TW> ? TW : Record<string, unknown>;

// Curried to allow explicit T/TWrite while inferring the literal config shape S.
export function defineResource<T, TWrite = Record<string, unknown>>() {
  return function <const S extends ResourceConfig<T, TWrite>>(config: S): S & TypeBrand<T, TWrite> {
    return config as S & TypeBrand<T, TWrite>;
  };
}

export function createReadOnlyResource<T>(type: string, path: string = type) {
  return defineResource<T>()({ type, path, writableKeys: [] as const, operations: ['list', 'find'] as const });
}

export function ref(type: string, id: string): ResourceRef {
  return { id, type };
}

export function isIncluded<T extends ResourceRef>(value: T | ResourceRef | undefined | null): value is T {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).length > 2;
}
