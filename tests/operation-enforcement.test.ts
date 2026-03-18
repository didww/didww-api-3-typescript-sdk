import { describe, it, expect } from 'vitest';
import { type HttpClient, Repository, createRepository } from '../src/repositories/repository.js';
import type { ResourceConfig } from '../src/resources/base.js';

// Stub HttpClient that never makes real requests
const stubClient: HttpClient = {
  async get() {
    return {};
  },
  async post() {
    return {};
  },
  async patch() {
    return {};
  },
  async delete() {},
};

// ── Read-only resource (list + find) ──────────────────────────────────────────

const READ_ONLY_CONFIG = {
  type: 'things',
  path: 'things',
  writableKeys: [],
  operations: ['list', 'find'],
} as const satisfies ResourceConfig;

describe('Read-only resource runtime enforcement', () => {
  it('allows list()', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.list()).resolves.toBeDefined();
  });

  it('allows find()', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.find('123')).resolves.toBeDefined();
  });

  it('throws on create()', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.create({})).rejects.toThrow(
      "Operation 'create' is not supported on resource 'things'. Allowed operations: list, find",
    );
  });

  it('throws on update()', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.update({ id: '1' })).rejects.toThrow(
      "Operation 'update' is not supported on resource 'things'. Allowed operations: list, find",
    );
  });

  it('throws on remove()', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.remove('1')).rejects.toThrow(
      "Operation 'remove' is not supported on resource 'things'. Allowed operations: list, find",
    );
  });
});

// ── Full CRUD resource (list + find + create + update + remove) ───────────────

const CRUD_CONFIG = {
  type: 'widgets',
  path: 'widgets',
  writableKeys: ['name'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
} as const satisfies ResourceConfig;

describe('Full CRUD resource runtime enforcement', () => {
  it('allows list()', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.list()).resolves.toBeDefined();
  });

  it('allows find()', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.find('123')).resolves.toBeDefined();
  });

  it('allows create()', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.create({ name: 'test' })).resolves.toBeDefined();
  });

  it('allows update()', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.update({ id: '1', name: 'test' })).resolves.toBeDefined();
  });

  it('allows remove()', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.remove('1')).resolves.toBeUndefined();
  });
});

// ── Create-only resource (list + find + create + remove) ──────────────────────

const CREATE_ONLY_CONFIG = {
  type: 'items',
  path: 'items',
  writableKeys: ['value'],
  operations: ['list', 'find', 'create', 'remove'],
} as const satisfies ResourceConfig;

describe('Create-only resource runtime enforcement', () => {
  it('allows list()', async () => {
    const repo = new Repository(stubClient, CREATE_ONLY_CONFIG);
    await expect(repo.list()).resolves.toBeDefined();
  });

  it('allows find()', async () => {
    const repo = new Repository(stubClient, CREATE_ONLY_CONFIG);
    await expect(repo.find('123')).resolves.toBeDefined();
  });

  it('allows create()', async () => {
    const repo = new Repository(stubClient, CREATE_ONLY_CONFIG);
    await expect(repo.create({ value: 'x' })).resolves.toBeDefined();
  });

  it('allows remove()', async () => {
    const repo = new Repository(stubClient, CREATE_ONLY_CONFIG);
    await expect(repo.remove('1')).resolves.toBeUndefined();
  });

  it('throws on update()', async () => {
    const repo = new Repository(stubClient, CREATE_ONLY_CONFIG);
    await expect(repo.update({ id: '1', value: 'x' })).rejects.toThrow(
      "Operation 'update' is not supported on resource 'items'. Allowed operations: list, find, create, remove",
    );
  });
});

// ── Singleton resource (find only) ───────────────────────────────────────────

const SINGLETON_CONFIG = {
  type: 'settings',
  path: 'settings',
  writableKeys: [],
  operations: ['find'],
  singleton: true,
} as const satisfies ResourceConfig;

describe('Singleton resource runtime enforcement', () => {
  it('allows find()', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.find()).resolves.toBeDefined();
  });

  it('throws on list()', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.list()).rejects.toThrow(
      "Operation 'list' is not supported on resource 'settings'. Allowed operations: find",
    );
  });

  it('throws on create()', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.create({})).rejects.toThrow(
      "Operation 'create' is not supported on resource 'settings'. Allowed operations: find",
    );
  });

  it('throws on update()', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.update({ id: '1' })).rejects.toThrow(
      "Operation 'update' is not supported on resource 'settings'. Allowed operations: find",
    );
  });

  it('throws on remove()', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.remove('1')).rejects.toThrow(
      "Operation 'remove' is not supported on resource 'settings'. Allowed operations: find",
    );
  });
});

// ── List+find+remove resource (like encrypted_files) ─────────────────────────

const LIST_FIND_REMOVE_CONFIG = {
  type: 'files',
  path: 'files',
  writableKeys: [],
  operations: ['list', 'find', 'remove'],
} as const satisfies ResourceConfig;

describe('List+find+remove resource runtime enforcement', () => {
  it('allows list()', async () => {
    const repo = new Repository(stubClient, LIST_FIND_REMOVE_CONFIG);
    await expect(repo.list()).resolves.toBeDefined();
  });

  it('allows find()', async () => {
    const repo = new Repository(stubClient, LIST_FIND_REMOVE_CONFIG);
    await expect(repo.find('123')).resolves.toBeDefined();
  });

  it('allows remove()', async () => {
    const repo = new Repository(stubClient, LIST_FIND_REMOVE_CONFIG);
    await expect(repo.remove('1')).resolves.toBeUndefined();
  });

  it('throws on create()', async () => {
    const repo = new Repository(stubClient, LIST_FIND_REMOVE_CONFIG);
    await expect(repo.create({})).rejects.toThrow(
      "Operation 'create' is not supported on resource 'files'. Allowed operations: list, find, remove",
    );
  });

  it('throws on update()', async () => {
    const repo = new Repository(stubClient, LIST_FIND_REMOVE_CONFIG);
    await expect(repo.update({ id: '1' })).rejects.toThrow(
      "Operation 'update' is not supported on resource 'files'. Allowed operations: list, find, remove",
    );
  });
});

// ── Non-singleton find() requires a non-empty string id ──────────────────────

describe('Non-singleton find() runtime id validation', () => {
  it('throws when called without arguments on a non-singleton resource', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.find()).rejects.toThrow(
      "find() on non-singleton resource 'things' requires a non-empty string id as the first argument",
    );
  });

  it('throws when called with an empty string on a non-singleton resource', async () => {
    const repo = new Repository(stubClient, CRUD_CONFIG);
    await expect(repo.find('')).rejects.toThrow(
      "find() on non-singleton resource 'widgets' requires a non-empty string id as the first argument",
    );
  });

  it('throws when called with a QueryParams object on a non-singleton resource', async () => {
    const repo = new Repository(stubClient, READ_ONLY_CONFIG);
    await expect(repo.find({ include: 'foo' })).rejects.toThrow(
      "find() on non-singleton resource 'things' requires a non-empty string id as the first argument",
    );
  });

  it('does not throw when called without arguments on a singleton resource', async () => {
    const repo = new Repository(stubClient, SINGLETON_CONFIG);
    await expect(repo.find()).resolves.toBeDefined();
  });
});

// ── createRepository factory type inference ──────────────────────────────────

describe('createRepository factory', () => {
  it('creates a repository with correct runtime enforcement for read-only', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createRepository(stubClient, READ_ONLY_CONFIG) as any;
    await expect(repo.list()).resolves.toBeDefined();
    await expect(repo.find('1')).resolves.toBeDefined();
    await expect(repo.create({})).rejects.toThrow("Operation 'create' is not supported");
    await expect(repo.update({ id: '1' })).rejects.toThrow("Operation 'update' is not supported");
    await expect(repo.remove('1')).rejects.toThrow("Operation 'remove' is not supported");
  });

  it('creates a repository with correct runtime enforcement for singleton', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createRepository(stubClient, SINGLETON_CONFIG) as any;
    await expect(repo.find()).resolves.toBeDefined();
    await expect(repo.list()).rejects.toThrow("Operation 'list' is not supported");
    await expect(repo.create({})).rejects.toThrow("Operation 'create' is not supported");
  });

  it('creates a repository with correct runtime enforcement for create-only', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createRepository(stubClient, CREATE_ONLY_CONFIG) as any;
    await expect(repo.list()).resolves.toBeDefined();
    await expect(repo.find('1')).resolves.toBeDefined();
    await expect(repo.create({ value: 'x' })).resolves.toBeDefined();
    await expect(repo.remove('1')).resolves.toBeUndefined();
    await expect(repo.update({ id: '1' })).rejects.toThrow("Operation 'update' is not supported");
  });
});
