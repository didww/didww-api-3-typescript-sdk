import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref } from '../../src/resources/base.js';
import { DidwwApiError } from '../../src/errors.js';
import { serializeForCreate } from '../../src/serializer.js';
import { SMS_TRUNK_REGENERATE_CREDENTIAL_RESOURCE } from '../../src/resources/sms-trunk-regenerate-credential.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

const HTTP_OUT_ID = '1a2b3c4d-0003-4a5b-8c6d-7e8f9a0b1c03';

describe('SmsTrunkRegenerateCredentials', () => {
  describeOperationEnforcement({
    clientMethod: 'smsTrunkRegenerateCredentials',
    allowedOperations: ['create'],
    resourceType: 'sms_trunk_regenerate_credentials',
  });

  it('regenerates the credentials of an SMS trunk', async () => {
    const client = setupClient('sms_trunk_regenerate_credentials/create.yaml');
    const result = await client.smsTrunkRegenerateCredentials().create({ smsTrunk: ref('sms_trunks', HTTP_OUT_ID) });
    expect(result.data.id).toBe('3c4d5e6f-0001-4c7d-8e9f-0a1b2c3d4e01');
    expect(result.data.type).toBe('sms_trunk_regenerate_credentials');
  });

  it('raises DidwwApiError for a trunk without credentials', async () => {
    const client = setupClient('sms_trunk_regenerate_credentials/create_error.yaml');
    const error = await client
      .smsTrunkRegenerateCredentials()
      .create({ smsTrunk: ref('sms_trunks', HTTP_OUT_ID) })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(422);
    expect((error as DidwwApiError).errors[0].source?.pointer).toBe('/data/relationships/sms_trunk');
  });

  it('sends only the trunk relationship', () => {
    const body = serializeForCreate(SMS_TRUNK_REGENERATE_CREDENTIAL_RESOURCE, {
      id: 'ignored',
      smsTrunk: ref('sms_trunks', HTTP_OUT_ID),
    } as never);
    expect(body).toEqual({
      data: {
        type: 'sms_trunk_regenerate_credentials',
        relationships: { sms_trunk: { data: { id: HTTP_OUT_ID, type: 'sms_trunks' } } },
      },
    });
  });
});
