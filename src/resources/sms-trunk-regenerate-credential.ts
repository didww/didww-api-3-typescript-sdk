import { defineResource, type ResourceRef } from './base.js';
import type { SmsTrunk } from './sms-trunk.js';

/**
 * Regenerates the credentials of an `smpp_esme` or `http_out` SMS trunk. The
 * answer carries no credentials: read the trunk again to get them.
 */
export interface SmsTrunkRegenerateCredential {
  id: string;
  type: 'sms_trunk_regenerate_credentials';
  smsTrunk?: SmsTrunk | ResourceRef;
}

export interface SmsTrunkRegenerateCredentialWrite {
  smsTrunk: ResourceRef;
}

export const SMS_TRUNK_REGENERATE_CREDENTIAL_RESOURCE = defineResource<
  SmsTrunkRegenerateCredential,
  SmsTrunkRegenerateCredentialWrite
>()({
  type: 'sms_trunk_regenerate_credentials',
  path: 'sms_trunk_regenerate_credentials',
  writableKeys: ['smsTrunk'],
  relationshipKeys: ['smsTrunk'],
  operations: ['create'],
});
