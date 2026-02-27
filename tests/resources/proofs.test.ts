import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { ProofType } from '../../src/resources/proof-type.js';

describe('Proofs', () => {
  afterEach(() => cleanupNock());

  it('creates a proof', async () => {
    loadCassette('proofs/create.yaml');
    const client = createTestClient();
    const result = await client.proofs().create({
      proofType: ref('proof_types', '19cd7b22-559b-41d4-99c9-7ad7ad63d5d1'),
      files: [ref('encrypted_files', '254b3c2d-c40c-4ff7-93b1-a677aee7fa10')],
    });
    expect(result.data.id).toBe('ed46925b-a830-482d-917d-015858cf7ab9');
    const pt = result.data.proofType;
    expect(pt).toBeDefined();
    expect(isIncluded(pt!)).toBe(true);
    expect((pt as ProofType).name).toBe('Drivers License');
  });

  it('deletes a proof', async () => {
    loadCassette('proofs/delete.yaml');
    const client = createTestClient();
    await expect(client.proofs().remove('ed46925b-a830-482d-917d-015858cf7ab9')).resolves.toBeUndefined();
  });
});
