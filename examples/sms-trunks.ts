/**
 * SMS Trunks: lists trunks, creates an HTTP IN trunk, updates its configuration,
 * regenerates the credentials of an HTTP OUT trunk, and deletes both trunks,
 * also when a step fails.
 *
 * Configuration builders:
 *   - smsToEmailConfiguration, smsHttpInConfiguration: DIDWW delivers inbound
 *     messages by email or HTTP
 *   - smsHttpOutConfiguration, smsSmppEsmeConfiguration: you connect to DIDWW;
 *     DIDWW generates the credentials, which are read-only
 *   - smsSmppSmscConfiguration: DIDWW binds to your SMSC
 *
 * The read-only allowIn / allowOut tell which directions a trunk handles.
 * console.log() of a configuration masks its credentials.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/sms-trunks.ts
 */
import {
  DidwwClient,
  Environment,
  SmsBodyType,
  SmsHttpMethod,
  isIncluded,
  isSmsHttpIn,
  isSmsHttpOut,
  ref,
  smsHttpInConfiguration,
  smsHttpOutConfiguration,
} from '../src/index.js';
import type { SmsTrunkGroup } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

const suffix = crypto.randomBytes(4).toString('hex');

async function listTrunks() {
  console.log('=== Existing SMS Trunks ===');
  const trunks = await client.smsTrunks().list({ include: 'sms_trunk_group', page: { number: 1, size: 10 } });
  console.log(`Found ${trunks.data.length} SMS trunks`);
  for (const trunk of trunks.data) {
    console.log(`${trunk.name} [${trunk.configuration.type}]`);
    console.log(`  ID: ${trunk.id}`);
    console.log(`  Inbound: ${trunk.allowIn}, outbound: ${trunk.allowOut}`);
    if (isIncluded<SmsTrunkGroup>(trunk.smsTrunkGroup)) {
      console.log(`  Group: ${trunk.smsTrunkGroup.name}`);
    }
    if (trunk.meta?.host) console.log(`  Submit URL: ${trunk.meta.host}`);
  }
}

/**
 * Creates an HTTP OUT trunk, regenerates its credentials and deletes it.
 *
 * The generated credentials of http_out and smpp_esme trunks are rotated
 * with an sms_trunk_regenerate_credentials request and read back from the trunk.
 */
async function httpOutRoundTrip() {
  console.log('\n=== Creating HTTP OUT Trunk and Regenerating Its Credentials ===');
  let trunkId: string | undefined;
  try {
    const created = await client.smsTrunks().create({
      name: `TS HTTP OUT ${suffix}`,
      configuration: smsHttpOutConfiguration({
        callbackUrl: 'https://example.com/sms/status',
        allowedIps: ['203.0.113.10'],
      }),
    });
    trunkId = created.data.id;
    console.log(`Created SMS trunk: ${trunkId}`);

    await client.smsTrunkRegenerateCredentials().create({ smsTrunk: ref('sms_trunks', trunkId) });

    // The answer carries no credentials: read the trunk again.
    const reloaded = await client.smsTrunks().find(trunkId);
    const credentials = reloaded.data.configuration;
    if (isSmsHttpOut(credentials)) {
      // Use credentials.authName and credentials.authPassword to submit
      // messages to reloaded.data.meta.host. Never print them.
      console.log('Credentials regenerated:');
      console.log(`  authName: ${credentials.authName ? 'present' : 'absent'}`);
      console.log(`  authPassword: ${credentials.authPassword ? 'present' : 'absent'}`);
      console.log(`  Submit URL: ${reloaded.data.meta?.host}`);
    }
  } finally {
    if (trunkId !== undefined) {
      await client.smsTrunks().remove(trunkId);
      console.log('HTTP OUT trunk deleted');
    }
  }
}

async function main() {
  await listTrunks();

  console.log('\n=== Creating HTTP IN Trunk ===');
  let createdId: string | undefined;
  try {
    const created = await client.smsTrunks().create({
      name: `TS HTTP IN ${suffix}`,
      externalReferenceId: `ts-sms-${suffix}`,
      configuration: smsHttpInConfiguration({
        url: 'https://example.com/sms',
        // POST and PUT need a body type and a body; GET takes neither.
        httpMethod: SmsHttpMethod.POST,
        bodyType: SmsBodyType.JSON,
        // Placeholders: {SMS_TEXT}, {SMS_TEXT_BASE64_ENCODED}, {SMS_SRC_ADDR}, {SMS_DST_ADDR}, {SMS_TIME}
        body: '{"text":"{SMS_TEXT}","from":"{SMS_SRC_ADDR}","to":"{SMS_DST_ADDR}"}',
        validateHttpsCertificate: true,
      }),
    });
    createdId = created.data.id;
    console.log(`Created SMS trunk: ${created.data.id} - ${created.data.name}`);
    console.log('  Configuration:', created.data.configuration);

    // The configuration type cannot change; attributes left out keep their values.
    console.log('\n=== Updating HTTP IN Trunk ===');
    const updated = await client.smsTrunks().update({
      id: createdId,
      name: `TS HTTP IN ${suffix} (v2)`,
      configuration: smsHttpInConfiguration({ url: 'https://example.com/sms-v2' }),
    });
    if (isSmsHttpIn(updated.data.configuration)) {
      console.log(`Updated: ${updated.data.name} -> ${updated.data.configuration.url}`);
    }

    await httpOutRoundTrip();
  } finally {
    if (createdId !== undefined) {
      console.log('\n=== Deleting HTTP IN Trunk ===');
      await client.smsTrunks().remove(createdId);
      console.log('SMS trunk deleted');
    }
  }
}

main().catch(console.error);
