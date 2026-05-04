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
import type { DiversionInjectMode, DiversionRelayPolicy, NetworkProtocolPriority } from '../../src/enums.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('VoiceInTrunks', () => {
  describeOperationEnforcement({
    clientMethod: 'voiceInTrunks',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'voice_in_trunks',
  });
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
    expect(first.externalReferenceId).toBe('vit-ref-001');
  });

  it('lists SIP configuration attributes', async () => {
    const client = setupClient('voice_in_trunks/list.yaml');
    const result = await client.voiceInTrunks().list();
    const sipTrunk = result.data.find((t) => t.configuration?.type === 'sip_configurations');
    expect(sipTrunk).toBeDefined();
    const config = sipTrunk!.configuration as SipConfiguration;
    expect(config.username).toBe('username');
    expect(config.host).toBe('203.0.113.78');
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
    const client = setupClient('voice_in_trunks/create_sip_with_rerouting.yaml');
    const result = await client.voiceInTrunks().create({
      name: 'hello, test sip trunk',
      configuration: sipConfiguration({
        username: 'username',
        host: '203.0.113.110',
        port: 5060,
        codecIds: [Codec.PCMU, Codec.PCMA, Codec.G729, Codec.G723, Codec.TELEPHONE_EVENT],
        reroutingDisconnectCodeIds: [
          ReroutingDisconnectCode.SIP_400_BAD_REQUEST,
          ReroutingDisconnectCode.SIP_402_PAYMENT_REQUIRED,
          ReroutingDisconnectCode.SIP_403_FORBIDDEN,
          ReroutingDisconnectCode.SIP_404_NOT_FOUND,
          ReroutingDisconnectCode.RINGING_TIMEOUT,
        ],
        // API 2026-04-16 writable attributes
        diversionRelayPolicy: 'as_is' as DiversionRelayPolicy,
        diversionInjectMode: 'did_number' as DiversionInjectMode,
        networkProtocolPriority: 'force_ipv4' as NetworkProtocolPriority,
        cnamLookup: true,
        // useDidInRuri must stay false unless enabledSipRegistration is
        // also true (server returns 422 otherwise).
        useDidInRuri: false,
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
    const client = setupClient('voice_in_trunks/update_sip_with_rerouting.yaml');
    const result = await client.voiceInTrunks().update({
      id: 'a80006b6-4183-4865-8b99-7ebbd359a762',
      name: 'hello, updated test sip trunk',
      configuration: sipConfiguration({
        username: 'new-username',
        host: '203.0.113.110',
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
    const client = setupClient('voice_in_trunks/create_pstn.yaml');
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
    const client = setupClient('voice_in_trunks/update_pstn.yaml');
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

  describe('2026-04-16 SIP-registration attributes', () => {
    // The server requires `host` and `port` to be left blank when
    // `enabled_sip_registration` is true, so the test fixtures below
    // intentionally omit them.
    it('serializes the writable 2026-04-16 attributes for POST/PATCH', () => {
      const config = sipConfiguration({
        enabledSipRegistration: true,
        useDidInRuri: true,
        cnamLookup: true,
        diversionInjectMode: 'did_number' as DiversionInjectMode,
        networkProtocolPriority: 'prefer_ipv4' as NetworkProtocolPriority,
      });
      const data = serializeTrunkConfiguration(config);
      expect(data.type).toBe('sip_configurations');
      expect(data.attributes).toMatchObject({
        enabledSipRegistration: true,
        useDidInRuri: true,
        cnamLookup: true,
        diversionInjectMode: 'did_number',
        networkProtocolPriority: 'prefer_ipv4',
      });
    });

    it('deserializes the read-only incoming_auth credentials from a server response', () => {
      // Real wire shape (captured from sandbox): when sip_registration is
      // enabled, host/port/username come back as null.
      const sipData = {
        type: 'sip_configurations',
        attributes: {
          username: null,
          host: null,
          port: null,
          enabledSipRegistration: true,
          useDidInRuri: true,
          cnamLookup: true,
          diversionInjectMode: 'none',
          networkProtocolPriority: 'any',
          incomingAuthUsername: 'sipreg-user-1',
          incomingAuthPassword: 's3cret-Pa55',
        },
      };
      const sip = deserializeTrunkConfiguration(sipData) as SipConfiguration;
      expect(sip.enabledSipRegistration).toBe(true);
      expect(sip.useDidInRuri).toBe(true);
      expect(sip.cnamLookup).toBe(true);
      expect(sip.diversionInjectMode).toBe('none');
      expect(sip.networkProtocolPriority).toBe('any');
      expect(sip.incomingAuthUsername).toBe('sipreg-user-1');
      expect(sip.incomingAuthPassword).toBe('s3cret-Pa55');
    });

    it('returns populated incoming_auth credentials when create sends enabled_sip_registration: true', async () => {
      // End-to-end: SDK sends `enabledSipRegistration: true` → server
      // returns 201 with generated `incomingAuthUsername` and
      // `incomingAuthPassword`. The SDK must surface populated values to
      // the caller, not null.
      const client = setupClient('voice_in_trunks/create_with_sip_registration.yaml');
      const result = await client.voiceInTrunks().create({
        name: 'sip-registration',
        priority: 1,
        weight: 100,
        cliFormat: 'e164',
        ringingTimeout: 30,
        configuration: sipConfiguration({
          enabledSipRegistration: true,
          useDidInRuri: true,
          cnamLookup: true,
          diversionRelayPolicy: 'as_is' as DiversionRelayPolicy,
          diversionInjectMode: 'did_number' as DiversionInjectMode,
          networkProtocolPriority: 'prefer_ipv4' as NetworkProtocolPriority,
        }),
      });
      const config = result.data.configuration as SipConfiguration;
      expect(config.enabledSipRegistration).toBe(true);
      // Server-generated credentials are populated, not null.
      expect(config.incomingAuthUsername).toBeTruthy();
      expect(config.incomingAuthPassword).toBeTruthy();
    });

    it('disable patch sends enabled_sip_registration:false + host + use_did_in_ruri:false together', async () => {
      // The disable flow is a multi-field PATCH because the server's V3
      // form rejects (422) any request that flips
      // `enabled_sip_registration` to false without simultaneously
      // providing a non-blank `host` (model-level presence) and
      // `use_did_in_ruri: false` (form-level). Lock those three fields
      // in the same request body — nock's body matcher rejects the
      // request if any of them is missing or has the wrong value.
      const client = setupClient('voice_in_trunks/disable_sip_registration.yaml');
      const result = await client.voiceInTrunks().update({
        id: '57a939dd-1600-41a6-80b1-f624e22a1f4c',
        configuration: sipConfiguration({
          enabledSipRegistration: false,
          useDidInRuri: false,
          host: '203.0.113.10',
        }),
      });
      const config = result.data.configuration as SipConfiguration;
      expect(config.enabledSipRegistration).toBe(false);
      expect(config.useDidInRuri).toBe(false);
      expect(config.host).toBe('203.0.113.10');
      expect(config.incomingAuthUsername).toBeNull();
      expect(config.incomingAuthPassword).toBeNull();
    });

    it('strips read-only incoming_auth credentials from the write payload', () => {
      // Simulate a caller mutating a read-shape object (e.g. trunk loaded from
      // a GET) and submitting it back. The server returns 400 Param not allowed
      // if these fields are echoed, so the SDK must strip them defensively.
      const loaded = {
        type: 'sip_configurations',
        enabledSipRegistration: true,
        useDidInRuri: true,
        incomingAuthUsername: 'sipreg-user-1',
        incomingAuthPassword: 's3cret-Pa55',
      } as SipConfiguration;
      const data = serializeTrunkConfiguration(loaded);
      expect(data.attributes.enabledSipRegistration).toBe(true);
      expect(data.attributes.useDidInRuri).toBe(true);
      expect(data.attributes).not.toHaveProperty('incomingAuthUsername');
      expect(data.attributes).not.toHaveProperty('incomingAuthPassword');
    });
  });
});
