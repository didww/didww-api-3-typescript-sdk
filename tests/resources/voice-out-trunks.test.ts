import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Did } from '../../src/resources/did.js';
import type { CredentialsAndIpAuthenticationMethod } from '../../src/nested/authentication-method.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('VoiceOutTrunks', () => {
  describeOperationEnforcement({
    clientMethod: 'voiceOutTrunks',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'voice_out_trunks',
  });
  it('lists voice out trunks', async () => {
    const client = setupClient('voice_out_trunks/list.yaml');
    const result = await client.voiceOutTrunks().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].externalReferenceId).toBe('vot-ref-001');
  });

  it('finds a voice out trunk', async () => {
    const client = setupClient('voice_out_trunks/show.yaml');
    const result = await client.voiceOutTrunks().find('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    expect(result.data.id).toBe('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    expect(result.data.type).toBe('voice_out_trunks');
    expect(result.data.name).toBe('test');
    expect(result.data.status).toBe('blocked');
    expect(result.data.capacityLimit).toBe(123);
    expect(result.data.allowAnyDidAsCli).toBe(false);
    expect(result.data.mediaEncryptionMode).toBe('srtp_sdes');
    expect(result.data.forceSymmetricRtp).toBe(true);
    expect(result.data.rtpPing).toBe(true);
    expect(result.data.thresholdReached).toBe(false);
    expect(result.data.thresholdAmount).toBe('200.0');
    expect(result.data.callbackUrl).toBeNull();
    expect(result.data.emergencyEnableAll).toBe(false);
    expect(result.data.rtpTimeout).toBe(30);
    // Polymorphic authentication_method
    const authMethod = result.data.authenticationMethod;
    expect(authMethod).toBeDefined();
    expect(authMethod.type).toBe('credentials_and_ip');
    const credAuth = authMethod as CredentialsAndIpAuthenticationMethod;
    expect(credAuth.allowedSipIps).toEqual(['10.11.12.13/32']);
    expect(credAuth.username).toBe('dpjgwbbac9');
    expect(credAuth.password).toBe('z0hshvbcy7');
    expect(result.data.dids).toBeDefined();
    expect(result.data.dids!.length).toBe(2);
    expect(isIncluded(result.data.dids![0])).toBe(true);
    const defaultDid = result.data.defaultDid;
    expect(defaultDid).toBeDefined();
    expect(isIncluded(defaultDid!)).toBe(true);
    expect((defaultDid as Did).number).toBe('37061498222');
  });

  it('creates a voice out trunk with ip_only authentication_method', async () => {
    const client = setupClient('voice_out_trunks/create.yaml');
    const result = await client.voiceOutTrunks().create({
      name: 'ts-test',
      onCliMismatchAction: 1 as unknown as import('../../src/enums.js').OnCliMismatchAction,
      authenticationMethod: {
        type: 'ip_only',
        allowedSipIps: ['203.0.113.0/24'],
        techPrefix: '',
      },
      defaultDid: { id: '7a028c32-e6b6-4c86-bf01-90f901b37012', type: 'dids' },
      dids: [{ id: '7a028c32-e6b6-4c86-bf01-90f901b37012', type: 'dids' }],
    });
    expect(result.data.id).toBe('b60201c1-21f0-4d9a-aafa-0e6d1e12f22e');
    expect(result.data.name).toBe('ts-test');
    expect(result.data.status).toBe('active');
    expect(result.data.authenticationMethod).toBeDefined();
  });

  it('updates a voice out trunk', async () => {
    const client = setupClient('voice_out_trunks/update.yaml');
    const result = await client.voiceOutTrunks().update({
      id: '425ce763-a3a9-49b4-af5b-ada1a65c8864',
      name: 'test',
      capacityLimit: 123,
      forceSymmetricRtp: true,
      rtpPing: true,
    });
    expect(result.data.id).toBe('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    expect(result.data.name).toBe('test');
    expect(result.data.status).toBe('blocked');
    expect(result.data.authenticationMethod).toBeDefined();
    expect(result.data.capacityLimit).toBe(123);
    expect(result.data.mediaEncryptionMode).toBe('disabled');
    expect(result.data.forceSymmetricRtp).toBe(true);
    expect(result.data.rtpPing).toBe(true);
  });

  it('updates authentication_method on a voice out trunk', async () => {
    const client = setupClient('voice_out_trunks/update_auth_method.yaml');
    const result = await client.voiceOutTrunks().update({
      id: '425ce763-a3a9-49b4-af5b-ada1a65c8864',
      authenticationMethod: {
        type: 'credentials_and_ip',
        allowedSipIps: ['192.0.2.10/32'],
        techPrefix: '99',
      } as import('../../src/nested/authentication-method.js').AuthenticationMethod,
    });
    expect(result.data.id).toBe('425ce763-a3a9-49b4-af5b-ada1a65c8864');
    const authMethod = result.data.authenticationMethod;
    expect(authMethod.type).toBe('credentials_and_ip');
  });

  it('deletes a voice out trunk', async () => {
    const client = setupClient('voice_out_trunks/delete.yaml');
    await expect(client.voiceOutTrunks().remove('425ce763-a3a9-49b4-af5b-ada1a65c8864')).resolves.toBeUndefined();
  });
});
