export interface ResourceRef {
  id: string;
  type: string;
}

export type Operation = 'list' | 'find' | 'create' | 'update' | 'remove';

export interface ResourceConfig<T = Record<string, unknown>, TWrite = Record<string, unknown>> {
  readonly type: string;
  readonly path: string;
  readonly writableKeys: readonly (keyof TWrite)[];
  readonly relationshipKeys?: readonly (keyof TWrite)[];
  readonly serializeCustom?: (data: TWrite, method: 'POST' | 'PATCH') => Record<string, unknown>;
  readonly deserializeCustom?: (data: Record<string, unknown>) => Partial<T>;
  readonly operations: readonly Operation[];
  readonly singleton?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyResourceConfig = ResourceConfig<any, any>;

export function createReadOnlyResource<T>(
  type: string,
  path: string = type,
): ResourceConfig<T, Record<string, unknown>> & { readonly operations: readonly ['list', 'find'] } {
  return { type, path, writableKeys: [], operations: ['list', 'find'] as const };
}

export function ref(type: string, id: string): ResourceRef {
  return { id, type };
}

export function isIncluded<T extends ResourceRef>(value: T | ResourceRef | undefined | null): value is T {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).length > 2;
}
