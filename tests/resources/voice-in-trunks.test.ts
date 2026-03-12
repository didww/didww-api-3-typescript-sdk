import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Pop } from '../../src/resources/pop.js';
import {
  serializeTrunkConfiguration,
  deserializeTrunkConfiguration,
  sipConfiguration,
  pstnConfiguration,
} from '../../src/nested/trunk-configuration.js';
import type { SipConfiguration, PstnConfiguration } from '../../src/nested/trunk-configuration.js';
import { Codec, ReroutingDisconnectCode } from '../../src/enums.js';

describe('VoiceInTrunks', () => {
  it('lists voice in trunks', async () => {
    const client = setupClient('voice_in_trunks/list.yaml');
    const result = await client.voiceInTrunks().list();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    const first = result.data[0];
    expect(first.id).toBe('2b4b1fcf-fe6a-4de9-8a58-7df46820ba13');
    expect(first.name).toBe('sample trunk pstn');
    expect(first.voiceInTrunkGroup).toBeUndefined();
    expect(first.pop).toBeUndefined();
    const second = result.data[1];
    expect(second.pop).toBeDefined();
    expect(isIncluded(second.pop!)).toBe(true);
    expect((second.pop as Pop).name).toBe('DE, FRA');
  });

  it('lists SIP configuration attributes', async () => {
    const client = setupClient('voice_in_trunks/list.yaml');
    const result = await client.voiceInTrunks().list();
    const sipTrunk = result.data.find((t) => t.configuration?.type === 'sip_configurations');
    expect(sipTrunk).toBeDefined();
    const config = sipTrunk!.configuration as SipConfiguration;
    expect(config.username).toBe('username');
    expect(config.host).toBe('216.58.215.78');
    expect(config.port).toBe(8060);
    expect(config.codecIds).toEqual([9, 10, 8]);
    expect(config.transportProtocolId).toBe(1);
    expect(config.authEnabled).toBe(true);
    expect(config.authUser).toBe('auth_user');
    expect(config.authPassword).toBe('auth_password');
    expect(config.authFromUser).toBe('');
    expect(config.authFromDomain).toBe('');
    expect(config.resolveRuri).toBe(true);
    expect(config.rxDtmfFormatId).toBe(1);
    expect(config.txDtmfFormatId).toBe(1);
    expect(config.sstEnabled).toBe(false);
    expect(config.sstMinTimer).toBe(600);
    expect(config.sstMaxTimer).toBe(900);
    expect(config.sstAccept_501).toBe(true);
    expect(config.sipTimerB).toBe(8000);
    expect(config.dnsSrvFailoverTimer).toBe(2000);
    expect(config.rtpPing).toBe(false);
    expect(config.forceSymmetricRtp).toBe(false);
    expect(config.reroutingDisconnectCodeIds).toBeNull();
    expect(config.maxTransfers).toBe(2);
    expect(config.max_30xRedirects).toBe(5);
    expect(config.mediaEncryptionMode).toBe('disabled');
    expect(config.stirShakenMode).toBe('disabled');
    expect(config.allowedRtpIps).toBeNull();
  });

  it('creates a voice in trunk with SIP config and rerouting disconnect codes', async () => {
    const client = setupClient('voice_in_trunks/create_10.yaml');
    const result = await client.voiceInTrunks().create({
      name: 'hello, test sip trunk',
      configuration: sipConfiguration({
        username: 'username',
        host: '216.58.215.110',
        port: 5060,
        codecIds: [Codec.PCMU, Codec.PCMA, Codec.G729, Codec.G723, Codec.TELEPHONE_EVENT],
        reroutingDisconnectCodeIds: [
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
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.SIP_400_BAD_REQUEST);
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.SIP_486_BUSY_HERE);
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.SIP_502_BAD_GATEWAY);
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.RINGING_TIMEOUT);
  });

  it('updates a voice in trunk with rerouting disconnect codes', async () => {
    const client = setupClient('voice_in_trunks/update_11.yaml');
    const result = await client.voiceInTrunks().update({
      id: 'a80006b6-4183-4865-8b99-7ebbd359a762',
      name: 'hello, updated test sip trunk',
      configuration: sipConfiguration({
        username: 'new-username',
        host: '216.58.215.110',
        port: 5060,
        codecIds: [Codec.PCMU, Codec.PCMA, Codec.G729, Codec.G723, Codec.TELEPHONE_EVENT],
        reroutingDisconnectCodeIds: [
          ReroutingDisconnectCode.SIP_400_BAD_REQUEST,
          ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
        ],
      }),
    });
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('hello, updated test sip trunk');
    const config = result.data.configuration as SipConfiguration;
    expect(config.username).toBe('new-username');
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.SIP_400_BAD_REQUEST);
    expect(config.reroutingDisconnectCodeIds).toContain(ReroutingDisconnectCode.RINGING_TIMEOUT);
  });

  it('creates a voice in trunk with PSTN config', async () => {
    const client = setupClient('voice_in_trunks/create.yaml');
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

  it('updates a voice in trunk with PSTN config', async () => {
    const client = setupClient('voice_in_trunks/update_2.yaml');
    const result = await client.voiceInTrunks().update({
      id: '41b94706-325e-4704-a433-d65105758836',
      name: 'hello, updated test pstn trunk',
      configuration: pstnConfiguration({ dst: '558540420025' }),
    });
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('hello, updated test pstn trunk');
    const config = result.data.configuration as PstnConfiguration;
    expect(config.type).toBe('pstn_configurations');
    expect(config.dst).toBe('558540420025');
  });

  it('deletes a voice in trunk', async () => {
    const client = setupClient('voice_in_trunks/delete.yaml');
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
      codecIds: [Codec.PCMU, Codec.PCMA, Codec.G729],
      username: 'user',
      reroutingDisconnectCodeIds: [
        ReroutingDisconnectCode.SIP_486_BUSY_HERE,
        ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
        ReroutingDisconnectCode.RINGING_TIMEOUT,
      ],
    });
    const data = serializeTrunkConfiguration(config);
    expect(data.type).toBe('sip_configurations');
    expect(data.attributes.username).toBe('user');
    expect(data.attributes.host).toBe('example.com');
    expect(data.attributes.codecIds).toEqual([Codec.PCMU, Codec.PCMA, Codec.G729]);
    expect(data.attributes.reroutingDisconnectCodeIds).toEqual([
      ReroutingDisconnectCode.SIP_486_BUSY_HERE,
      ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
      ReroutingDisconnectCode.RINGING_TIMEOUT,
    ]);
  });

  it('deserializes configuration', () => {
    const pstnData = { type: 'pstn_configurations', attributes: { dst: '12345' } };
    const pstn = deserializeTrunkConfiguration(pstnData);
    expect(pstn.type).toBe('pstn_configurations');
    expect((pstn as PstnConfiguration).dst).toBe('12345');

    const sipData = { type: 'sip_configurations', attributes: { username: 'user' } };
    const sip = deserializeTrunkConfiguration(sipData);
    expect(sip.type).toBe('sip_configurations');
    expect((sip as SipConfiguration).username).toBe('user');
  });
});
