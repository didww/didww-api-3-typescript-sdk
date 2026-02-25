import { camel, snake, deserialise, serialise } from 'kitsu-core';
import type { ResourceMeta, ResourceRef } from './resources/base.js';

const KITSU_OPTS = {
  camelCaseTypes: (s: string) => s,
  pluralTypes: (s: string) => s,
};

function snakeToCamelKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(snakeToCamelKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [camel(k), snakeToCamelKeys(v)]),
    );
  }
  return obj;
}

function camelToSnakeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelToSnakeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [snake(k), camelToSnakeKeys(v)]),
    );
  }
  return obj;
}

export interface DeserializedResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface DeserializedListResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface SerializedResource {
  data: {
    type: string;
    id?: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

export function deserialize<T>(body: unknown): DeserializedResponse<T> | DeserializedListResponse<T> {
  const result = deserialise(body);
  const camelCased = snakeToCamelKeys(result) as Record<string, unknown>;
  if (Array.isArray(camelCased.data)) {
    camelCased.data = (camelCased.data as unknown[]).map(unwrapResourceProps);
  } else if (camelCased.data && typeof camelCased.data === 'object') {
    camelCased.data = unwrapResourceProps(camelCased.data);
  }
  return camelCased as unknown as DeserializedResponse<T> | DeserializedListResponse<T>;
}

function isResourceLike(val: unknown): boolean {
  return typeof val === 'object' && val !== null && 'id' in val && 'type' in val;
}

function isRelationshipWrapper(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (!keys.every((k) => k === 'data' || k === 'links')) return false;
  if ('links' in obj) {
    const links = obj.links;
    if (typeof links === 'object' && links !== null && ('self' in links || 'related' in links)) return true;
  }
  if (keys.length === 1 && 'data' in obj) {
    const data = obj.data;
    if (data === null) return true;
    if (Array.isArray(data)) return data.length === 0 || isResourceLike(data[0]);
    return isResourceLike(data);
  }
  return false;
}

function unwrapResourceProps(resource: unknown): unknown {
  if (typeof resource !== 'object' || resource === null) return resource;
  const record = resource as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record)
      .map(([k, v]) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          const obj = v as Record<string, unknown>;
          if (isRelationshipWrapper(obj)) {
            if ('data' in obj && obj.data !== undefined) {
              const inner = obj.data;
              if (Array.isArray(inner)) return [k, inner.map(unwrapResourceProps)];
              return [k, unwrapResourceProps(inner)];
            }
            return [k, undefined];
          }
        }
        return [k, v];
      })
      .filter(([, v]) => v !== undefined),
  );
}

export function serializeForCreate<T, TWrite>(meta: ResourceMeta<T, TWrite>, data: TWrite): SerializedResource {
  const filtered = filterWritableKeys(data, meta.writableKeys);
  const toSerialize = meta.serializeCustom ? meta.serializeCustom(data, 'POST') : filtered;
  const snaked = camelToSnakeKeys(toSerialize) as Record<string, unknown>;
  const prepared = wrapRelationships(snaked);
  return serialise(meta.type, prepared, 'POST', KITSU_OPTS);
}

export function serializeForUpdate<T, TWrite>(
  meta: ResourceMeta<T, TWrite>,
  data: TWrite & { id: string },
): SerializedResource {
  const filtered = filterWritableKeys(data, meta.writableKeys);
  (filtered as Record<string, unknown>).id = data.id;
  const toSerialize = meta.serializeCustom ? { ...meta.serializeCustom(data, 'PATCH'), id: data.id } : filtered;
  const snaked = camelToSnakeKeys(toSerialize) as Record<string, unknown>;
  const prepared = wrapRelationships(snaked);
  return serialise(meta.type, prepared, 'PATCH', KITSU_OPTS);
}

function filterWritableKeys<TWrite>(data: TWrite, writableKeys: (keyof TWrite)[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of writableKeys) {
    if (key in (data as Record<string, unknown>)) {
      result[key as string] = (data as Record<string, unknown>)[key as string];
    }
  }
  return result;
}

function isResourceRef(value: unknown): value is ResourceRef {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in (value as Record<string, unknown>) &&
    'type' in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).type === 'string'
  );
}

function isResourceRefArray(value: unknown): value is ResourceRef[] {
  return Array.isArray(value) && value.length > 0 && isResourceRef(value[0]);
}

/**
 * Wrap ResourceRef values into { data: { id, type } } format
 * so kitsu-core detects them as relationships.
 */
function wrapRelationships(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isResourceRef(value)) {
      result[key] = { data: { id: value.id, type: value.type } };
    } else if (isResourceRefArray(value)) {
      result[key] = { data: value.map((r) => ({ id: r.id, type: r.type })) };
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Wrap a null value as a null relationship for JSON:API.
 * Used by resources that need to explicitly clear relationships.
 */
export function nullRelationship(): { data: null } {
  return { data: null };
}
