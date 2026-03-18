/**
 * Type-level tests to verify that operation constraints are properly enforced.
 * Uses vitest's expectTypeOf() to assert that disallowed methods are absent
 * from the narrowed repository types returned by DidwwClient and createRepository.
 */
import { describe, it, expectTypeOf } from 'vitest';
import { DidwwClient, Environment } from '../src/index.js';
import { createRepository, type HttpClient } from '../src/repositories/repository.js';
import type { ResourceConfig } from '../src/resources/base.js';

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

describe('Type-level operation constraints', () => {
  describe('read-only resources (list + find)', () => {
    it('countries() exposes list and find', () => {
      const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
      const repo = client.countries();
      expectTypeOf(repo).toHaveProperty('list');
      expectTypeOf(repo).toHaveProperty('find');
    });

    it('countries() does NOT expose create, update, remove', () => {
      const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
      const repo = client.countries();
      expectTypeOf(repo).not.toHaveProperty('create');
      expectTypeOf(repo).not.toHaveProperty('update');
      expectTypeOf(repo).not.toHaveProperty('remove');
    });
  });

  describe('singleton resources (find only)', () => {
    it('balance() exposes find', () => {
      const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
      const repo = client.balance();
      expectTypeOf(repo).toHaveProperty('find');
    });

    it('balance() does NOT expose list, create, update, remove', () => {
      const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
      const repo = client.balance();
      expectTypeOf(repo).not.toHaveProperty('list');
      expectTypeOf(repo).not.toHaveProperty('create');
      expectTypeOf(repo).not.toHaveProperty('update');
      expectTypeOf(repo).not.toHaveProperty('remove');
    });
  });

  describe('createRepository with inline config', () => {
    it('infers operations from as-const config', () => {
      const config = {
        type: 'things',
        path: 'things',
        writableKeys: [],
        operations: ['list', 'find'],
      } as const satisfies ResourceConfig;

      const repo = createRepository(stubClient, config);
      expectTypeOf(repo).toHaveProperty('list');
      expectTypeOf(repo).toHaveProperty('find');
      expectTypeOf(repo).not.toHaveProperty('create');
      expectTypeOf(repo).not.toHaveProperty('update');
      expectTypeOf(repo).not.toHaveProperty('remove');
    });

    it('singleton config produces singleton find', () => {
      const config = {
        type: 'settings',
        path: 'settings',
        writableKeys: [],
        operations: ['find'],
        singleton: true,
      } as const satisfies ResourceConfig;

      const repo = createRepository(stubClient, config);
      expectTypeOf(repo).toHaveProperty('find');
      expectTypeOf(repo).not.toHaveProperty('list');
      expectTypeOf(repo).not.toHaveProperty('create');
    });
  });
});
