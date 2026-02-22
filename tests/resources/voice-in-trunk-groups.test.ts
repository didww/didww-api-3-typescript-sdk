import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('VoiceInTrunkGroups', () => {
  afterEach(() => cleanupNock());

  it('lists voice in trunk groups', async () => {
    loadCassette('voice_in_trunk_groups/list.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunkGroups().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('voice_in_trunk_groups');
  });

  it('creates a voice in trunk group', async () => {
    loadCassette('voice_in_trunk_groups/create.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunkGroups().create({
      name: 'trunk group sample with 2 trunks',
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.name).toBe('trunk group sample with 2 trunks');
  });

  it('deletes a voice in trunk group', async () => {
    loadCassette('voice_in_trunk_groups/delete.yaml');
    const client = createTestClient();
    await expect(client.voiceInTrunkGroups().remove('b2319703-ce6c-480d-bb53-614e7abcfc96')).resolves.toBeUndefined();
  });
});
