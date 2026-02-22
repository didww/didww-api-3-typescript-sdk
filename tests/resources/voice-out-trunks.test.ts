import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('VoiceOutTrunks', () => {
  afterEach(() => cleanupNock());

  it('lists voice out trunks', async () => {
    loadCassette('voice_out_trunks/list.yaml');
    const client = createTestClient();
    const result = await client.voiceOutTrunks().list();
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('finds a voice out trunk', async () => {
    loadCassette('voice_out_trunks/show.yaml');
    const client = createTestClient();
    const result = await client.voiceOutTrunks().find('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    expect(result.data.id).toBe('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    expect(result.data.type).toBe('voice_out_trunks');
    expect(result.data.name).toBe('test');
    expect(result.data.status).toBe('blocked');
    expect(result.data.allowed_sip_ips).toEqual(['10.11.12.13/32']);
    expect(result.data.capacity_limit).toBe(123);
    expect(result.data.allow_any_did_as_cli).toBe(false);
    expect(result.data.media_encryption_mode).toBe('srtp_sdes');
    expect(result.data.force_symmetric_rtp).toBe(true);
    expect(result.data.rtp_ping).toBe(true);
    expect(result.data.threshold_reached).toBe(false);
    expect(result.data.threshold_amount).toBe('200.0');
    expect(result.data.callback_url).toBeNull();
    expect(result.data.username).toBe('dpjgwbbac9');
    expect(result.data.password).toBe('z0hshvbcy7');
  });

  it('creates a voice out trunk', async () => {
    loadCassette('voice_out_trunks/create.yaml');
    const client = createTestClient();
    const result = await client.voiceOutTrunks().create({
      name: 'ts-test',
      allowed_sip_ips: ['0.0.0.0/0'],
      on_cli_mismatch_action: 1,
      default_did: { id: '7a028c32-e6b6-4c86-bf01-90f901b37012', type: 'dids' },
      dids: [{ id: '7a028c32-e6b6-4c86-bf01-90f901b37012', type: 'dids' }],
    });
    expect(result.data.id).toBe('b60201c1-21f0-4d9a-aafa-0e6d1e12f22e');
    expect(result.data.name).toBe('ts-test');
    expect(result.data.status).toBe('active');
  });
});
