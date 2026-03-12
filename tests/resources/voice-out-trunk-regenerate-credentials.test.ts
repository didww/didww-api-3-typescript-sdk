import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('VoiceOutTrunkRegenerateCredentials', () => {
  it('creates a regenerate credential', async () => {
    loadCassette('voice_out_trunk_regenerate_credentials/create.yaml');
    const client = createTestClient();
    const result = await client.voiceOutTrunkRegenerateCredentials().create({});
    expect(result.data.id).toBe('5fc59e7e-79eb-498a-8779-800416b5c68a');
  });
});
