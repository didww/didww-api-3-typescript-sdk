/**
 * Type-level tests to verify that operation constraints are properly enforced.
 * Uses vitest's expectTypeOf() to assert that disallowed methods are absent
 * from the narrowed repository types returned by DidwwClient and createRepository.
 */
import { describe, it, expectTypeOf } from 'vitest';
import {
  DidwwClient,
  type DidwwClientOptions,
  Environment,
  type Scope,
  type Pop,
  smsHttpOutConfiguration,
  smsSmppEsmeConfiguration,
  type DidGroup,
  type DidWrite,
  type ResourceRef,
  type SenderIdVerification,
  type SenderIdVerificationWrite,
  type SmsTrunkGroupWrite,
  type SmsTrunkWrite,
  type VoiceInTrunk,
  type VoiceInTrunkWrite,
} from '../src/index.js';
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

describe('API 2026-10-22 resource types', () => {
  const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });

  it('has no pops() or didGroupTypes()', () => {
    expectTypeOf<DidwwClient>().not.toHaveProperty('pops');
    expectTypeOf<DidwwClient>().not.toHaveProperty('didGroupTypes');
  });

  it('smsTrunks() and smsTrunkGroups() expose every operation', () => {
    for (const repo of [client.smsTrunks(), client.smsTrunkGroups()]) {
      expectTypeOf(repo).toHaveProperty('list');
      expectTypeOf(repo).toHaveProperty('find');
      expectTypeOf(repo).toHaveProperty('create');
      expectTypeOf(repo).toHaveProperty('update');
      expectTypeOf(repo).toHaveProperty('remove');
    }
  });

  it('smsTrunkRegenerateCredentials() exposes only create', () => {
    const repo = client.smsTrunkRegenerateCredentials();
    expectTypeOf(repo).toHaveProperty('create');
    expectTypeOf(repo).not.toHaveProperty('list');
    expectTypeOf(repo).not.toHaveProperty('find');
    expectTypeOf(repo).not.toHaveProperty('update');
    expectTypeOf(repo).not.toHaveProperty('remove');
  });

  it('senderIdVerifications() exposes list, find and update only', () => {
    const repo = client.senderIdVerifications();
    expectTypeOf(repo).toHaveProperty('list');
    expectTypeOf(repo).toHaveProperty('find');
    expectTypeOf(repo).toHaveProperty('update');
    expectTypeOf(repo).not.toHaveProperty('create');
    expectTypeOf(repo).not.toHaveProperty('remove');
  });

  it('write types leave out read-only attributes and relationships', () => {
    expectTypeOf<SmsTrunkWrite>().not.toHaveProperty('incomingDids');
    expectTypeOf<SmsTrunkWrite>().not.toHaveProperty('senderIdVerifications');
    expectTypeOf<SmsTrunkWrite>().not.toHaveProperty('allowIn');
    expectTypeOf<SmsTrunkWrite>().not.toHaveProperty('allowOut');
    expectTypeOf<SmsTrunkWrite>().not.toHaveProperty('createdAt');
    expectTypeOf<SmsTrunkGroupWrite>().not.toHaveProperty('incomingDids');
    expectTypeOf<keyof SenderIdVerificationWrite>().toEqualTypeOf<'name' | 'smsTrunk'>();
  });

  it('types the new and changed fields', () => {
    expectTypeOf<VoiceInTrunkWrite['pop']>().toEqualTypeOf<Pop | null | undefined>();
    expectTypeOf<VoiceInTrunk['pop']>().toEqualTypeOf<Pop | null>();
    expectTypeOf<SenderIdVerification['renewDate']>().toEqualTypeOf<string | null>();
    expectTypeOf<DidWrite['smsTrunk']>().toEqualTypeOf<ResourceRef | null | undefined>();
    expectTypeOf<DidWrite['smsTrunkGroup']>().toEqualTypeOf<ResourceRef | null | undefined>();
    expectTypeOf<DidGroup>().toHaveProperty('numberType');
    expectTypeOf<DidGroup['isDemo']>().toEqualTypeOf<boolean>();
    expectTypeOf<DidGroup>().not.toHaveProperty('didGroupType');
  });

  it('accepts a null scope, as the scope getter returns', () => {
    const client = new DidwwClient({ apiKey: 'k', scope: null });
    expectTypeOf(client.scope).toEqualTypeOf<Scope | null>();
    new DidwwClient({ apiKey: 'k', scope: client.scope });
    expectTypeOf<DidwwClientOptions['scope']>().toEqualTypeOf<Scope | null | undefined>();
  });

  it('builders refuse the read-only credentials', () => {
    // @ts-expect-error authPassword is generated by the API
    smsHttpOutConfiguration({ authPassword: 'x' });
    // @ts-expect-error systemId is generated by the API
    smsSmppEsmeConfiguration({ systemId: 'x' });
  });
});
