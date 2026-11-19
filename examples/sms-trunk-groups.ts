/**
 * SMS Trunk Groups: creates two inbound SMS trunks, puts them in a group, lists
 * groups, and deletes the group, also when a step fails.
 *
 * A group spreads a DID's inbound messages over its trunks by their priority
 * (higher first). http_out trunks cannot join a group. Deleting a group also
 * deletes the trunks in it.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/sms-trunk-groups.ts
 */
import {
  DidwwClient,
  Environment,
  SmsHttpMethod,
  isIncluded,
  ref,
  smsHttpInConfiguration,
  smsToEmailConfiguration,
} from '../src/index.js';
import type { SmsTrunk } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const trunkIds: string[] = [];
  let groupId: string | undefined;
  try {
    console.log('=== Creating SMS Trunks ===');
    const primary = await client.smsTrunks().create({
      name: `TS primary ${suffix}`,
      priority: 200,
      configuration: smsHttpInConfiguration({
        url: 'https://example.com/sms',
        httpMethod: SmsHttpMethod.GET, // GET takes no body type and no body
        queryParameters: { text: '{SMS_TEXT}', from: '{SMS_SRC_ADDR}' },
      }),
    });
    trunkIds.push(primary.data.id);
    console.log(`Created SMS trunk: ${primary.data.id} - ${primary.data.name}`);

    const fallback = await client.smsTrunks().create({
      name: `TS fallback ${suffix}`,
      priority: 100,
      configuration: smsToEmailConfiguration({
        sendTo: 'sms@example.com',
        subject: 'Inbound SMS',
        message: 'You have a new message.',
      }),
    });
    trunkIds.push(fallback.data.id);
    console.log(`Created SMS trunk: ${fallback.data.id} - ${fallback.data.name}`);

    console.log('\n=== Creating SMS Trunk Group ===');
    const created = await client.smsTrunkGroups().create({
      name: `TS SMS Group ${suffix}`,
      externalReferenceId: `ts-sms-group-${suffix}`,
      // The list replaces the group's membership
      smsTrunks: trunkIds.map((id) => ref('sms_trunks', id)),
    });
    groupId = created.data.id;
    console.log(`Created SMS trunk group: ${created.data.id} - ${created.data.name}`);

    console.log('\n=== Existing SMS Trunk Groups ===');
    const groups = await client.smsTrunkGroups().list({ include: 'sms_trunks', page: { number: 1, size: 5 } });
    for (const g of groups.data) {
      const names = (g.smsTrunks || [])
        .filter((t): t is SmsTrunk => isIncluded(t))
        .map((t) => t.name)
        .join(', ');
      console.log(`${g.name} (${g.meta?.smsTrunksCount ?? 0} trunks) ${names}`);
    }
  } finally {
    if (groupId !== undefined) {
      console.log('\n=== Deleting SMS Trunk Group (and its trunks) ===');
      await client.smsTrunkGroups().remove(groupId);
      console.log('SMS trunk group deleted');
    } else {
      // Without a group the trunks are deleted one by one
      for (const trunkId of trunkIds) {
        await client.smsTrunks().remove(trunkId);
        console.log(`SMS trunk deleted: ${trunkId}`);
      }
    }
  }
}

main().catch(console.error);
