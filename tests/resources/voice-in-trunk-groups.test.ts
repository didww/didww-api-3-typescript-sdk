import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { VoiceInTrunk } from '../../src/resources/voice-in-trunk.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('VoiceInTrunkGroups', () => {
  describeOperationEnforcement({
    clientMethod: 'voiceInTrunkGroups',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'voice_in_trunk_groups',
  });
  it('lists voice in trunk groups', async () => {
    const client = setupClient('voice_in_trunk_groups/list.yaml');
    const result = await client.voiceInTrunkGroups().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('voice_in_trunk_groups');
    const trunks = result.data[0].voiceInTrunks;
    expect(trunks).toBeDefined();
    expect(trunks!.length).toBe(2);
    expect(isIncluded(trunks![0])).toBe(true);
    expect((trunks![0] as VoiceInTrunk).name).toBe('URI 33141081249');
  });

  it('creates a voice in trunk group', async () => {
    const client = setupClient('voice_in_trunk_groups/create.yaml');
    const result = await client.voiceInTrunkGroups().create({
      name: 'trunk group sample with 2 trunks',
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.name).toBe('trunk group sample with 2 trunks');
    const trunks = result.data.voiceInTrunks;
    expect(trunks).toBeDefined();
    expect(trunks!.length).toBe(2);
    expect(isIncluded(trunks![0])).toBe(true);
    expect((trunks![0] as VoiceInTrunk).name).toBe('test custom11');
  });

  it('updates a voice in trunk group', async () => {
    const client = setupClient('voice_in_trunk_groups/update.yaml');
    const result = await client.voiceInTrunkGroups().update({
      id: 'b2319703-ce6c-480d-bb53-614e7abcfc96',
      name: 'trunk group sample updated with 2 trunks',
      capacityLimit: '500',
    });
    expect(result.data.id).toBe('b2319703-ce6c-480d-bb53-614e7abcfc96');
    expect(result.data.name).toBe('trunk group sample updated with 2 trunks');
    expect(result.data.capacityLimit).toBe(500);
  });

  it('deletes a voice in trunk group', async () => {
    const client = setupClient('voice_in_trunk_groups/delete.yaml');
    await expect(client.voiceInTrunkGroups().remove('b2319703-ce6c-480d-bb53-614e7abcfc96')).resolves.toBeUndefined();
  });
});
