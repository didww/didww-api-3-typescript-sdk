export interface ResourceRef {
  id: string;
  type: string;
}

export interface ResourceConfig<T = Record<string, unknown>, TWrite = Record<string, unknown>> {
  type: string;
  path: string;
  writableKeys: (keyof TWrite)[];
  relationshipKeys?: (keyof TWrite)[];
  serializeCustom?: (data: TWrite, method: 'POST' | 'PATCH') => Record<string, unknown>;
  deserializeCustom?: (data: Record<string, unknown>) => Partial<T>;
}

export function createReadOnlyResource<T>(type: string, path: string = type): ResourceConfig<T> {
  return { type, path, writableKeys: [] };
}

export function ref(type: string, id: string): ResourceRef {
  return { id, type };
}

export function isIncluded<T extends ResourceRef>(value: T | ResourceRef | undefined | null): value is T {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).length > 2;
}
