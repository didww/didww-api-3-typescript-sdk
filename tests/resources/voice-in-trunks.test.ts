import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import {
  serializeTrunkConfiguration,
  deserializeTrunkConfiguration,
  sipConfiguration,
  pstnConfiguration,
} from '../../src/nested/trunk-configuration.js';
import type { SipConfiguration } from '../../src/nested/trunk-configuration.js';
import { Codec, ReroutingDisconnectCode } from '../../src/enums.js';

describe('VoiceInTrunks', () => {
  afterEach(() => cleanupNock());

  it('lists voice in trunks', async () => {
    loadCassette('voice_in_trunks/list.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunks().list();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    const first = result.data[0];
    expect(first.id).toBe('2b4b1fcf-fe6a-4de9-8a58-7df46820ba13');
    expect(first.name).toBe('sample trunk pstn');
  });

  it('lists SIP configuration attributes', async () => {
    loadCassette('voice_in_trunks/list.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunks().list();
    const sipTrunk = result.data.find((t) => t.configuration?.type === 'sip_configurations');
    expect(sipTrunk).toBeDefined();
    const config = sipTrunk!.configuration as SipConfiguration;
    expect(config.username).toBe('username');
    expect(config.host).toBe('216.58.215.78');
    expect(config.port).toBe(8060);
    expect(config.codec_ids).toEqual([9, 10, 8]);
    expect(config.transport_protocol_id).toBe(1);
    expect(config.auth_enabled).toBe(true);
    expect(config.auth_user).toBe('auth_user');
    expect(config.auth_password).toBe('auth_password');
    expect(config.auth_from_user).toBe('');
    expect(config.auth_from_domain).toBe('');
    expect(config.resolve_ruri).toBe(true);
    expect(config.rx_dtmf_format_id).toBe(1);
    expect(config.tx_dtmf_format_id).toBe(1);
    expect(config.sst_enabled).toBe(false);
    expect(config.sst_min_timer).toBe(600);
    expect(config.sst_max_timer).toBe(900);
    expect(config.sst_accept_501).toBe(true);
    expect(config.sip_timer_b).toBe(8000);
    expect(config.dns_srv_failover_timer).toBe(2000);
    expect(config.rtp_ping).toBe(false);
    expect(config.force_symmetric_rtp).toBe(false);
    expect(config.rerouting_disconnect_code_ids).toBeNull();
    expect(config.max_transfers).toBe(2);
    expect(config.max_30x_redirects).toBe(5);
    expect(config.media_encryption_mode).toBe('disabled');
    expect(config.stir_shaken_mode).toBe('disabled');
    expect(config.allowed_rtp_ips).toBeNull();
  });

  it('creates a voice in trunk with SIP config and rerouting disconnect codes', async () => {
    loadCassette('voice_in_trunks/create_10.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunks().create({
      name: 'hello, test sip trunk',
      configuration: sipConfiguration({
        username: 'username',
        host: '216.58.215.110',
        port: 5060,
        codec_ids: [Codec.PCMU, Codec.PCMA, Codec.G729, Codec.G723, Codec.TELEPHONE_EVENT],
        rerouting_disconnect_code_ids: [
          ReroutingDisconnectCode.SIP_400_BAD_REQUEST,
          ReroutingDisconnectCode.SIP_402_PAYMENT_REQUIRED,
          ReroutingDisconnectCode.SIP_403_FORBIDDEN,
          ReroutingDisconnectCode.SIP_404_NOT_FOUND,
          ReroutingDisconnectCode.RINGING_TIMEOUT,
        ],
      }),
    });
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('a80006b6-4183-4865-8b99-7ebbd359a762');
    const config = result.data.configuration as SipConfiguration;
    expect(config.type).toBe('sip_configurations');
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.SIP_400_BAD_REQUEST);
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.SIP_486_BUSY_HERE);
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.SIP_502_BAD_GATEWAY);
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.RINGING_TIMEOUT);
  });

  it('updates a voice in trunk with rerouting disconnect codes', async () => {
    loadCassette('voice_in_trunks/update_11.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunks().update({
      id: 'a80006b6-4183-4865-8b99-7ebbd359a762',
      name: 'hello, updated test sip trunk',
      configuration: sipConfiguration({
        username: 'new-username',
        host: '216.58.215.110',
        port: 5060,
        codec_ids: [Codec.PCMU, Codec.PCMA, Codec.G729, Codec.G723, Codec.TELEPHONE_EVENT],
        rerouting_disconnect_code_ids: [
          ReroutingDisconnectCode.SIP_400_BAD_REQUEST,
          ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
        ],
      }),
    });
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('hello, updated test sip trunk');
    const config = result.data.configuration as SipConfiguration;
    expect(config.username).toBe('new-username');
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.SIP_400_BAD_REQUEST);
    expect(config.rerouting_disconnect_code_ids).toContain(ReroutingDisconnectCode.RINGING_TIMEOUT);
  });

  it('creates a voice in trunk with PSTN config', async () => {
    loadCassette('voice_in_trunks/create.yaml');
    const client = createTestClient();
    const result = await client.voiceInTrunks().create({
      name: 'hello, test pstn trunk',
      configuration: pstnConfiguration({ dst: '558540420024' }),
    });
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('41b94706-325e-4704-a433-d65105758836');
    expect(result.data.name).toBe('hello, test pstn trunk');
    expect(result.data.configuration).toBeDefined();
    expect(result.data.configuration.type).toBe('pstn_configurations');
  });

  it('deletes a voice in trunk', async () => {
    loadCassette('voice_in_trunks/delete.yaml');
    const client = createTestClient();
    await expect(client.voiceInTrunks().remove('41b94706-325e-4704-a433-d65105758836')).resolves.toBeUndefined();
  });
});

describe('TrunkConfiguration serialization', () => {
  it('serializes PSTN configuration', () => {
    const config = pstnConfiguration({ dst: '558540420024' });
    const data = serializeTrunkConfiguration(config);
    expect(data).toEqual({
      type: 'pstn_configurations',
      attributes: { dst: '558540420024' },
    });
  });

  it('serializes SIP configuration', () => {
    const config = sipConfiguration({
      host: 'example.com',
      port: 5060,
      codec_ids: [Codec.PCMU, Codec.PCMA, Codec.G729],
      username: 'user',
      rerouting_disconnect_code_ids: [
        ReroutingDisconnectCode.SIP_486_BUSY_HERE,
        ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
        ReroutingDisconnectCode.RINGING_TIMEOUT,
      ],
    });
    const data = serializeTrunkConfiguration(config);
    expect(data.type).toBe('sip_configurations');
    expect(data.attributes.username).toBe('user');
    expect(data.attributes.host).toBe('example.com');
    expect(data.attributes.codec_ids).toEqual([Codec.PCMU, Codec.PCMA, Codec.G729]);
    expect(data.attributes.rerouting_disconnect_code_ids).toEqual([
      ReroutingDisconnectCode.SIP_486_BUSY_HERE,
      ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
      ReroutingDisconnectCode.RINGING_TIMEOUT,
    ]);
  });

  it('deserializes configuration', () => {
    const pstnData = { type: 'pstn_configurations', attributes: { dst: '12345' } };
    const pstn = deserializeTrunkConfiguration(pstnData);
    expect(pstn.type).toBe('pstn_configurations');
    expect((pstn as any).dst).toBe('12345');

    const sipData = { type: 'sip_configurations', attributes: { username: 'user' } };
    const sip = deserializeTrunkConfiguration(sipData);
    expect(sip.type).toBe('sip_configurations');
    expect((sip as any).username).toBe('user');
  });
});
