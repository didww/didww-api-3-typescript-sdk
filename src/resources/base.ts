export interface ResourceRef {
  id: string;
  type: string;
}

export interface ResourceMeta<T = any, TWrite = any> {
  type: string;
  path: string;
  writableKeys: (keyof TWrite)[];
  serializeCustom?: (data: TWrite, method: 'POST' | 'PATCH') => Record<string, unknown>;
  deserializeCustom?: (data: Record<string, unknown>) => Partial<T>;
}

export function ref(type: string, id: string): ResourceRef {
  return { id, type };
}
