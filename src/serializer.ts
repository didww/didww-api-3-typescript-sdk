import { camel, snake, deserialise, serialise } from 'kitsu-core';
import type { ResourceConfig, ResourceRef } from './resources/base.js';
import { getResourceConfig } from './registry.js';
import { filterWritableKeys } from './filter-writable-keys.js';
export { filterWritableKeys } from './filter-writable-keys.js';

const KITSU_OPTS = {
  camelCaseTypes: (s: string) => s,
  pluralTypes: (s: string) => s,
};

const CLEAN_WRITABLE_SNAPSHOTS = new WeakMap<object, Record<string, unknown>>();

function transformKeys(obj: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((o) => transformKeys(o, fn));
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [fn(k), transformKeys(v, fn)]),
    );
  }
  return obj;
}

function snakeToCamelKeys(obj: unknown): unknown {
  return transformKeys(obj, camel);
}
function camelToSnakeKeys(obj: unknown): unknown {
  return transformKeys(obj, snake);
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
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

export function deserialize<T>(body: unknown): DeserializedResponse<T> | DeserializedListResponse<T> {
  const result = deserialise(body);
  const camelCased = snakeToCamelKeys(result) as Record<string, unknown>;
  if (Array.isArray(camelCased.data)) {
    camelCased.data = (camelCased.data as unknown[]).map(unwrapResourceProps).map(applyRegistryDeserialize);
  } else if (camelCased.data && typeof camelCased.data === 'object') {
    camelCased.data = applyRegistryDeserialize(unwrapResourceProps(camelCased.data));
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

function applyRegistryDeserialize(resource: unknown): unknown {
  if (typeof resource !== 'object' || resource === null) return resource;
  const record = resource as Record<string, unknown>;

  // Recursively process nested resource-like objects (included relationships)
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && isResourceLike(value)) {
      record[key] = applyRegistryDeserialize(value);
    } else if (Array.isArray(value)) {
      record[key] = value.map((item) =>
        item !== null && typeof item === 'object' && isResourceLike(item) ? applyRegistryDeserialize(item) : item,
      );
    }
  }

  // Apply deserializeCustom for this resource if registry has one
  let meta: ResourceConfig | undefined;
  if ('type' in record && typeof record.type === 'string') {
    meta = getResourceConfig(record.type);
    if (meta?.deserializeCustom) {
      const deserialized = { ...record, ...meta.deserializeCustom(record) };
      snapshotCleanWritableValues(meta, deserialized);
      return deserialized;
    }
  }

  if (meta) {
    snapshotCleanWritableValues(meta, record);
  }

  return record;
}

export function serializeForCreate<T, TWrite>(meta: ResourceConfig<T, TWrite>, data: TWrite): SerializedResource {
  const filtered = filterWritableKeys(data, meta.writableKeys);
  const toSerialize = meta.serializeCustom ? meta.serializeCustom(data, 'POST') : filtered;
  const withNullRels = wrapRelationshipClears(
    toSerialize as Record<string, unknown>,
    meta.relationshipKeys as string[],
  );
  const snaked = camelToSnakeKeys(withNullRels) as Record<string, unknown>;
  const prepared = wrapRelationships(snaked);
  return serialise(meta.type, prepared, 'POST', KITSU_OPTS);
}

export function serializeForUpdate<T, TWrite>(
  meta: ResourceConfig<T, TWrite>,
  data: TWrite & { id: string },
): SerializedResource {
  const dirtyWritableKeys = detectDirtyWritableKeys(meta, data);
  const filtered = filterWritableKeys(data, meta.writableKeys, dirtyWritableKeys);
  (filtered as Record<string, unknown>).id = data.id;
  const toSerialize = meta.serializeCustom
    ? { ...meta.serializeCustom(filtered as TWrite, 'PATCH'), id: data.id }
    : filtered;
  const withNullRels = wrapRelationshipClears(
    toSerialize as Record<string, unknown>,
    meta.relationshipKeys as string[],
  );
  const snaked = camelToSnakeKeys(withNullRels) as Record<string, unknown>;
  const prepared = wrapRelationships(snaked);
  return serialise(meta.type, prepared, 'PATCH', KITSU_OPTS);
}


/**
 * Extract only { id, type } linkage from a relationship value.
 * For arrays, extract linkage from each element.
 * For non-relationship values, return as-is.
 */
function extractLinkage(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (isResourceRef(item)) return { id: item.id, type: item.type };
      return item;
    });
  }
  if (isResourceRef(value)) return { id: value.id, type: value.type };
  return value;
}

function detectDirtyWritableKeys<T, TWrite>(
  meta: ResourceConfig<T, TWrite>,
  data: TWrite & { id: string },
): ReadonlySet<string> {
  const record = data as Record<string, unknown>;
  const snapshot = CLEAN_WRITABLE_SNAPSHOTS.get(data as object);
  const result = new Set<string>();
  const relKeys = new Set<string>((meta.relationshipKeys as string[]) ?? []);

  for (const key of meta.writableKeys as string[]) {
    if (!(key in record)) continue;
    const current = relKeys.has(key) ? extractLinkage(record[key]) : record[key];
    const original = snapshot?.[key];
    if (!snapshot || !(key in snapshot) || !deepEqual(current, original)) {
      result.add(key);
    }
  }

  return result;
}

function snapshotCleanWritableValues<T, TWrite>(
  meta: ResourceConfig<T, TWrite>,
  resource: Record<string, unknown>,
): void {
  const snapshot: Record<string, unknown> = {};
  const relKeys = new Set<string>((meta.relationshipKeys as string[]) ?? []);
  for (const key of meta.writableKeys as string[]) {
    if (key in resource) {
      const value = relKeys.has(key) ? extractLinkage(resource[key]) : resource[key];
      snapshot[key] = cloneValue(value);
    }
  }
  CLEAN_WRITABLE_SNAPSHOTS.set(resource, snapshot);
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown> = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    for (const item of value) {
      cloned.push(cloneValue(item, seen));
    }
    return cloned;
  }

  const cloned: Record<string, unknown> = {};
  seen.set(value, cloned);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    cloned[k] = cloneValue(v, seen);
  }
  return cloned;
}

function deepEqual(
  a: unknown,
  b: unknown,
  seen: WeakMap<object, WeakSet<object>> = new WeakMap<object, WeakSet<object>>(),
): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  const aObj = a as object;
  const bObj = b as object;

  let compared = seen.get(aObj);
  if (!compared) {
    compared = new WeakSet<object>();
    seen.set(aObj, compared);
  } else if (compared.has(bObj)) {
    return true;
  }
  compared.add(bObj);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i], seen)) return false;
    }
    return true;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!(key in bRecord)) return false;
    if (!deepEqual(aRecord[key], bRecord[key], seen)) return false;
  }

  return true;
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
 * Wrap null and empty-array values for known relationship keys into JSON:API format
 * so kitsu-core places them under relationships instead of attributes.
 * - null → { data: null } (clear to-one)
 * - [] → { data: [] } (clear to-many)
 */
function wrapRelationshipClears(data: Record<string, unknown>, relationshipKeys?: string[]): Record<string, unknown> {
  if (!relationshipKeys) return data;
  const result = { ...data };
  for (const key of relationshipKeys) {
    if (key in result) {
      if (result[key] === null) {
        result[key] = { data: null };
      } else if (Array.isArray(result[key]) && (result[key] as unknown[]).length === 0) {
        result[key] = { data: [] };
      }
    }
  }
  return result;
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
