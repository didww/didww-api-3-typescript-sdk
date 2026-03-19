import { describe, it, expect } from 'vitest';
import type { Operation } from '../../src/resources/base.js';
import { DidwwClient } from '../../src/client.js';
import { Environment } from '../../src/configuration.js';

const ALL_OPERATIONS: Operation[] = ['list', 'find', 'create', 'update', 'remove'];

interface OperationEnforcementOptions {
  /** The client method name, e.g. 'countries', 'voiceOutTrunks' */
  clientMethod: keyof DidwwClient;
  /** The operations that should be allowed for this resource */
  allowedOperations: readonly Operation[];
  /** The JSON:API resource type string, e.g. 'countries', 'voice_out_trunks' */
  resourceType: string;
  /** Whether this is a singleton resource (find() takes no id) */
  singleton?: boolean;
}

/**
 * Creates a DidwwClient with a stub fetch that returns valid JSON:API responses.
 * This avoids hitting the network and makes tests fast.
 */
function createStubClient(): DidwwClient {
  const stubFetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    // Return a minimal valid JSON:API response
    const body = JSON.stringify({
      data: { id: 'stub-id', type: 'stub', attributes: {} },
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    });
  };

  return new DidwwClient({
    apiKey: 'test-key',
    environment: Environment.SANDBOX,
    fetch: stubFetch,
  });
}

/**
 * Generates a nested `describe('operation enforcement', ...)` block that
 * exhaustively tests operation enforcement for a given resource.
 * For each of the 5 possible operations, it asserts:
 * - Allowed operations do NOT throw an "Operation ... is not supported" error
 * - Disallowed operations throw the expected error with the correct message
 *
 * Must be called inside an existing `describe()` block.
 *
 * Usage in a resource test file:
 * ```ts
 * describe('Countries', () => {
 *   describeOperationEnforcement({
 *     clientMethod: 'countries',
 *     allowedOperations: ['list', 'find'],
 *     resourceType: 'countries',
 *   });
 *
 *   it('lists countries', async () => { ... });
 * });
 * ```
 */
export function describeOperationEnforcement(options: OperationEnforcementOptions): void {
  const { clientMethod, allowedOperations, resourceType, singleton = false } = options;
  const disallowedOperations = ALL_OPERATIONS.filter((op) => !allowedOperations.includes(op));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getRepo(): any {
    const client = createStubClient();
    return (client[clientMethod] as () => unknown)();
  }

  describe('operation enforcement', () => {
    for (const op of allowedOperations) {
      it(`allows ${op}()`, async () => {
        const repo = getRepo();
        switch (op) {
          case 'list':
            await expect(repo.list()).resolves.toBeDefined();
            break;
          case 'find':
            if (singleton) {
              await expect(repo.find()).resolves.toBeDefined();
            } else {
              await expect(repo.find('test-id')).resolves.toBeDefined();
            }
            break;
          case 'create':
            await expect(repo.create({})).resolves.toBeDefined();
            break;
          case 'update':
            await expect(repo.update({ id: 'test-id' })).resolves.toBeDefined();
            break;
          case 'remove':
            await expect(repo.remove('test-id')).resolves.toBeUndefined();
            break;
        }
      });
    }

    for (const op of disallowedOperations) {
      it(`rejects ${op}()`, async () => {
        const repo = getRepo();
        const expectedMessage = `Operation '${op}' is not supported on resource '${resourceType}'. Allowed operations: ${allowedOperations.join(', ')}`;

        switch (op) {
          case 'list':
            await expect(repo.list()).rejects.toThrow(expectedMessage);
            break;
          case 'find':
            await expect(repo.find('test-id')).rejects.toThrow(expectedMessage);
            break;
          case 'create':
            await expect(repo.create({})).rejects.toThrow(expectedMessage);
            break;
          case 'update':
            await expect(repo.update({ id: 'test-id' })).rejects.toThrow(expectedMessage);
            break;
          case 'remove':
            await expect(repo.remove('test-id')).rejects.toThrow(expectedMessage);
            break;
        }
      });
    }
  });
}
