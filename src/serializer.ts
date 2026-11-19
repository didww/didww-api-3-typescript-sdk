import { isDeepStrictEqual } from 'node:util';
import { camel, snake, serialise } from 'kitsu-core';
import type { ResourceConfig, ResourceRef } from './resources/base.js';
import { getResourceConfig } from './registry.js';
import { filterWritableKeys } from './filter-writable-keys.js';
import { cloneJson, isPlainObject, JsonNumber } from './json.js';
import { DidwwClientError } from './errors.js';
export { filterWritableKeys } from './filter-writable-keys.js';

const KITSU_OPTS = {
  camelCaseTypes: (s: string) => s,
  pluralTypes: (s: string) => s,
};

const CLEAN_WRITABLE_SNAPSHOTS = new WeakMap<object, Record<string, unknown>>();

// Only arrays and plain objects are walked: class instances (JsonNumber,
// Date, ...) are values, not maps of keys.
function transformKeys(obj: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((o) => transformKeys(o, fn));
  if (isPlainObject(obj)) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), transformKeys(v, fn)]));
  }
  return obj;
}

function camelToSnakeKeys(obj: unknown): unknown {
  return transformKeys(obj, snake);
}

// Camel-cases keys and turns JsonNumber into number in a value that holds no
// resources (attributes, meta, links).
function readValue(value: unknown): unknown {
  if (value instanceof JsonNumber) return value.valueOf();
  if (Array.isArray(value)) return value.map(readValue);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [camel(k), readValue(v)]));
  return value;
}

// The relationships to expand below a position of the read result, by wire
// name: the include path `outgoing_dids.sms_trunk` is one branch of the tree.
type IncludeTree = Map<string, IncludeTree>;

type ResourceObject = Record<string, unknown> & { id: string; type: string };

function isResourceObject(value: unknown): value is ResourceObject {
  return isPlainObject(value) && typeof value.id === 'string' && typeof value.type === 'string';
}

const keyOf = (resource: ResourceObject) => `${resource.type}#${resource.id}`;

function childOf(node: IncludeTree, name: string): IncludeTree {
  let child = node.get(name);
  if (!child) {
    child = new Map();
    node.set(name, child);
  }
  return child;
}

function addIncludePaths(tree: IncludeTree, include: string | readonly string[] | undefined): void {
  const paths = typeof include === 'string' ? [include] : (include ?? []);
  for (const path of paths.flatMap((p) => p.split(','))) {
    const names = path.split('.').map((name) => snake(name.trim()));
    if (names.includes('')) continue;
    let node = tree;
    for (const name of names) node = childOf(node, name);
  }
}

function linkageOf(relationship: unknown): ResourceObject[] {
  if (!isPlainObject(relationship)) return [];
  const data = relationship.data;
  if (Array.isArray(data)) return data.filter(isResourceObject);
  return isResourceObject(data) ? [data] : [];
}

// Adds the paths along which the document carries resources that the include
// paths do not reach: a document read without its request, or resources the
// server includes on its own. Breadth first, a relationship is followed only
// where it reaches a resource of the document that no shallower position
// holds, so the tree stays finite on cyclic links and does not depend on the
// order of the data.
function addDocumentPaths(
  tree: IncludeTree,
  primary: readonly string[],
  relationshipsOf: ReadonlyMap<string, Record<string, unknown>>,
): void {
  const claimed = new Set(primary);
  let level: Array<[IncludeTree, ReadonlySet<string>]> = [[tree, new Set(primary)]];
  while (level.length > 0) {
    const next: Array<[IncludeTree, ReadonlySet<string>]> = [];
    for (const [node, keys] of level) {
      for (const [name, targets] of reachedFrom(keys, relationshipsOf)) {
        if ([...targets].some((key) => !claimed.has(key))) next.push([childOf(node, name), targets]);
      }
    }
    for (const [, targets] of next) for (const key of targets) claimed.add(key);
    level = next;
  }
}

// The resources of the document that the relationships of `keys` reach, by relationship name.
function reachedFrom(
  keys: ReadonlySet<string>,
  relationshipsOf: ReadonlyMap<string, Record<string, unknown>>,
): Map<string, Set<string>> {
  const reached = new Map<string, Set<string>>();
  for (const key of keys) {
    for (const [name, relationship] of Object.entries(relationshipsOf.get(key) ?? {})) {
      for (const target of linkageOf(relationship)) {
        if (relationshipsOf.has(keyOf(target))) targetsOf(reached, name).add(keyOf(target));
      }
    }
  }
  return reached;
}

function targetsOf(reached: Map<string, Set<string>>, name: string): Set<string> {
  let targets = reached.get(name);
  if (!targets) {
    targets = new Set();
    reached.set(name, targets);
  }
  return targets;
}

// Builds the read result of a JSON:API document from its resource objects, as
// received: the resources of `data` and `included`, by type and id. The
// result follows the include tree: a relationship on it holds the included
// resource, built with the branch below it, and any other relationship holds
// the `{ id, type }` of its linkage. A relationship without linkage data
// holds only its links, which the read result then leaves out. The result is
// therefore a tree as deep as the include paths, which JSON.stringify can
// write, and complete on every requested path whatever the order of the
// data. A resource is built once per node of the tree and shared by the
// positions of that node, so the cost is bounded by the size of the document
// times the number of include paths. Wire attributes are kept exactly as
// received.
class ReadBuilder {
  private readonly built = new Map<IncludeTree, Map<object, Record<string, unknown>>>();

  constructor(
    private readonly resources: ReadonlyMap<string, ResourceObject>,
    private readonly relationshipsOf: ReadonlyMap<string, Record<string, unknown>>,
  ) {}

  resource(value: unknown, node: IncludeTree): unknown {
    if (!isPlainObject(value)) return readValue(value);
    const built = this.builtAt(node);
    const cached = built.get(value);
    if (cached) return cached;
    const key = isResourceObject(value) ? keyOf(value) : null;
    const wire = typeof value.type === 'string' ? getResourceConfig(value.type)?.wireAttributes : undefined;
    const result: Record<string, unknown> = {};
    const read = (k: string, v: unknown) => {
      const camelKey = camel(k);
      result[camelKey] = wire?.includes(camelKey) ? v : readValue(v);
    };
    for (const [k, v] of Object.entries(value)) if (k !== 'attributes' && k !== 'relationships') read(k, v);
    const relationships = (key !== null && this.relationshipsOf.get(key)) || value.relationships;
    if (isPlainObject(relationships)) this.readRelationships(relationships, node, result);
    if (isPlainObject(value.attributes)) for (const [k, v] of Object.entries(value.attributes)) read(k, v);
    built.set(value, result);
    return result;
  }

  private builtAt(node: IncludeTree): Map<object, Record<string, unknown>> {
    let built = this.built.get(node);
    if (!built) {
      built = new Map();
      this.built.set(node, built);
    }
    return built;
  }

  private readRelationships(
    relationships: Record<string, unknown>,
    node: IncludeTree,
    result: Record<string, unknown>,
  ): void {
    for (const [k, v] of Object.entries(relationships)) {
      if (isPlainObject(v)) result[camel(k)] = this.relationship(v, node.get(k));
    }
  }

  private relationship(relationship: Record<string, unknown>, node: IncludeTree | undefined): unknown {
    const linked = (linkage: unknown) => {
      if (!isResourceObject(linkage)) return readValue(linkage);
      const target = this.resources.get(keyOf(linkage));
      if (!node || !target) return { id: linkage.id, type: linkage.type };
      const resource = this.resource(target, node) as Record<string, unknown>;
      if (!isPlainObject(linkage.meta)) return resource;
      return { ...resource, meta: { ...(resource.meta as object), ...(readValue(linkage.meta) as object) } };
    };
    const result: Record<string, unknown> = {};
    if ('links' in relationship) result.links = readValue(relationship.links);
    if ('meta' in relationship) result.meta = readValue(relationship.meta);
    const { data } = relationship;
    if (Array.isArray(data)) result.data = data.map(linked);
    else if (data) result.data = linked(data);
    return result;
  }
}

// Snake-cases keys, except inside wire attributes, which are already in wire form.
function writeTransform(data: Record<string, unknown>, wireAttributes?: readonly string[]): Record<string, unknown> {
  if (!wireAttributes || wireAttributes.length === 0) return camelToSnakeKeys(data) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [snake(k), wireAttributes.includes(k) ? v : camelToSnakeKeys(v)]),
  );
}

interface DeserializedResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

interface DeserializedListResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

interface SerializedResource {
  data: {
    type: string;
    id?: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

/**
 * Reads a JSON:API document. `include` is the include parameter of the request
 * (`'a.b,c'` or `['a.b', 'c']`): every relationship on one of its paths holds
 * the included resource. Without it, or for resources the include paths do not
 * reach, an included resource is placed at the shallowest relationships that
 * reach it. Any other relationship holds its `{ id, type }` when the document
 * gives its linkage data, and is otherwise left out.
 */
export function deserialize<T>(
  body: unknown,
  include?: string | readonly string[],
): DeserializedResponse<T> | DeserializedListResponse<T> {
  if (!isPlainObject(body)) throw new DidwwClientError('The response is not a JSON:API document');
  const resources = new Map<string, ResourceObject>();
  const relationshipsOf = new Map<string, Record<string, unknown>>();
  const primaryKeys: string[] = [];
  const data = Array.isArray(body.data) ? body.data : [body.data];
  const included = Array.isArray(body.included) ? body.included : [];
  for (const [index, resource] of [...data, ...included].entries()) {
    if (!isResourceObject(resource)) continue;
    const key = keyOf(resource);
    if (index < data.length) primaryKeys.push(key);
    if (!resources.has(key)) resources.set(key, resource);
    const relationships = isPlainObject(resource.relationships) ? resource.relationships : {};
    relationshipsOf.set(key, { ...relationshipsOf.get(key), ...relationships });
  }
  const tree: IncludeTree = new Map();
  addIncludePaths(tree, include);
  addDocumentPaths(tree, primaryKeys, relationshipsOf);

  const builder = new ReadBuilder(resources, relationshipsOf);
  const camelCased = Object.fromEntries(
    Object.entries(body)
      .filter(([k]) => k !== 'included')
      .map(([k, v]) => {
        if (k !== 'data') return [camel(k), readValue(v)];
        return [k, Array.isArray(v) ? v.map((r) => builder.resource(r, tree)) : builder.resource(v, tree)];
      }),
  );
  // The read result shares resources, so each step keeps one result per object.
  const unwrapped = new Map<object, unknown>();
  const registered = new Map<object, unknown>();
  const finish = (item: unknown) => applyRegistryDeserialize(unwrapResourceProps(item, unwrapped), registered);
  if (Array.isArray(camelCased.data)) {
    camelCased.data = (camelCased.data as unknown[]).map(finish);
  } else if (camelCased.data && typeof camelCased.data === 'object') {
    camelCased.data = finish(camelCased.data);
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

function unwrapResourceProps(resource: unknown, done: Map<object, unknown>): unknown {
  if (typeof resource !== 'object' || resource === null) return resource;
  if (done.has(resource)) return done.get(resource);
  const record = resource as Record<string, unknown>;
  const result = Object.fromEntries(
    Object.entries(record)
      .map(([k, v]) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          const obj = v as Record<string, unknown>;
          if (isRelationshipWrapper(obj)) {
            if ('data' in obj && obj.data !== undefined) {
              const inner = obj.data;
              if (Array.isArray(inner)) return [k, inner.map((item) => unwrapResourceProps(item, done))];
              return [k, unwrapResourceProps(inner, done)];
            }
            return [k, undefined];
          }
        }
        return [k, v];
      })
      .filter(([, v]) => v !== undefined),
  );
  done.set(resource, result);
  return result;
}

// deserializeCustom is not idempotent, so a shared resource is processed once.
function applyRegistryDeserialize(resource: unknown, done: Map<object, unknown>): unknown {
  if (typeof resource !== 'object' || resource === null) return resource;
  const cached = done.get(resource);
  if (cached !== undefined) return cached;
  const record = resource as Record<string, unknown>;

  // Recursively process nested resource-like objects (included relationships)
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && isResourceLike(value)) {
      record[key] = applyRegistryDeserialize(value, done);
    } else if (Array.isArray(value)) {
      record[key] = value.map((item) =>
        item !== null && typeof item === 'object' && isResourceLike(item) ? applyRegistryDeserialize(item, done) : item,
      );
    }
  }

  // Apply deserializeCustom for this resource if registry has one
  let result = record;
  if ('type' in record && typeof record.type === 'string') {
    const meta = getResourceConfig(record.type);
    if (meta?.deserializeCustom) result = { ...record, ...meta.deserializeCustom(record) };
    if (meta) snapshotCleanWritableValues(meta, result);
  }
  done.set(resource, result);
  return result;
}

export function serializeForCreate<T, TWrite>(meta: ResourceConfig<T, TWrite>, data: TWrite): SerializedResource {
  const filtered = filterWritableKeys(data, meta.writableKeys);
  const toSerialize = meta.serializeCustom ? meta.serializeCustom(data, 'POST', data) : filtered;
  const withNullRels = wrapRelationshipClears(toSerialize, meta.relationshipKeys);
  const snaked = writeTransform(withNullRels, meta.wireAttributes);
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
    ? { ...meta.serializeCustom(filtered as TWrite, 'PATCH', data), id: data.id }
    : filtered;
  const withNullRels = wrapRelationshipClears(toSerialize, meta.relationshipKeys);
  const snaked = writeTransform(withNullRels, meta.wireAttributes);
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
  const snapshot = CLEAN_WRITABLE_SNAPSHOTS.get(data as object);
  const result = new Set<string>();
  const relKeys = new Set<string>(meta.relationshipKeys ?? []);

  for (const key of meta.writableKeys) {
    if (!(key in data)) continue;
    const current = relKeys.has(key) ? extractLinkage(data[key]) : data[key];
    const original = snapshot?.[key];
    if (!snapshot || !(key in snapshot) || !isDeepStrictEqual(current, original)) {
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
  const relKeys = new Set<string>(meta.relationshipKeys ?? []);
  for (const key of meta.writableKeys) {
    if (key in resource) {
      const value = relKeys.has(key) ? extractLinkage(resource[key]) : resource[key];
      snapshot[key] = cloneJson(value);
    }
  }
  CLEAN_WRITABLE_SNAPSHOTS.set(resource, snapshot);
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
function wrapRelationshipClears(
  data: Record<string, unknown>,
  relationshipKeys?: readonly string[],
): Record<string, unknown> {
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
