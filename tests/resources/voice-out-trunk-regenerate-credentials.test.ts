import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';

describe('VoiceOutTrunkRegenerateCredentials', () => {
  it('creates a regenerate credential', async () => {
    const client = setupClient('voice_out_trunk_regenerate_credentials/create.yaml');
    const result = await client.voiceOutTrunkRegenerateCredentials().create({});
    expect(result.data.id).toBe('5fc59e7e-79eb-498a-8779-800416b5c68a');
  });
});
