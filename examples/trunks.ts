/**
 * Voice IN trunks: lists trunks with their trunk group, creates a SIP trunk and
 * a PSTN trunk, finds the SIP trunk, updates both trunks and deletes both, also
 * when a step fails.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/trunks.ts
 */
import crypto from 'node:crypto';
import {
  CliFormat,
  Codec,
  DidwwClient,
  Environment,
  IceMode,
  Pop,
  ReroutingDisconnectCode,
  TransportProtocol,
  isIncluded,
  pstnConfiguration,
  sipConfiguration,
} from '../src/index.js';
import type { VoiceInTrunk, VoiceInTrunkGroup } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

function describe(trunk: VoiceInTrunk): string {
  const config = trunk.configuration;
  const target = config.type === 'pstn_configurations' ? `dst ${config.dst}` : `host ${config.host ?? 'none'}`;
  return `${trunk.name} (${config.type}, ${target}, POP ${trunk.pop ?? 'auto'})`;
}

async function main() {
  // List trunks with their trunk group
  console.log('=== Voice IN Trunks ===');
  const trunks = await client.voiceInTrunks().list({
    include: 'voice_in_trunk_group',
    page: { number: 1, size: 10 },
  });
  console.log(`Showing ${trunks.data.length} trunks`);
  for (const t of trunks.data) {
    const group = isIncluded<VoiceInTrunkGroup>(t.voiceInTrunkGroup) ? t.voiceInTrunkGroup.name : 'none';
    console.log(`  ${describe(t)}, trunk group: ${group}`);
  }

  const suffix = crypto.randomBytes(4).toString('hex');
  const createdIds: string[] = [];
  try {
    // Create a SIP trunk
    console.log('\n=== Creating SIP trunk ===');
    const sip = await client.voiceInTrunks().create({
      name: `Example SIP Trunk ${suffix}`,
      priority: 1,
      weight: 100,
      cliFormat: CliFormat.E164,
      ringingTimeout: 30,
      capacityLimit: 10,
      configuration: sipConfiguration({
        host: 'sip.example.com',
        port: 5060,
        // Codecs in priority order; left out, DIDWW applies its default list
        codecs: [Codec.PCMU, Codec.PCMA, Codec.TELEPHONE_EVENT],
        iceMode: IceMode.ACCEPT,
        transportProtocolId: TransportProtocol.UDP,
        reroutingDisconnectCodeIds: [
          ReroutingDisconnectCode.SIP_480_TEMPORARILY_UNAVAILABLE,
          ReroutingDisconnectCode.SIP_503_SERVICE_UNAVAILABLE,
        ],
      }),
      // Point of presence: a Pop value, or leave it out to let DIDWW choose
      pop: Pop.FRA,
    });
    createdIds.push(sip.data.id);
    console.log(`Created SIP trunk: ${sip.data.id} - ${describe(sip.data)}`);

    // Create a PSTN trunk
    console.log('\n=== Creating PSTN trunk ===');
    const pstn = await client.voiceInTrunks().create({
      name: `Example PSTN Trunk ${suffix}`,
      ringingTimeout: 30,
      configuration: pstnConfiguration({ dst: '12125551234' }),
    });
    createdIds.push(pstn.data.id);
    console.log(`Created PSTN trunk: ${pstn.data.id} - ${describe(pstn.data)}`);

    // Find the SIP trunk by id
    console.log('\n=== Finding SIP trunk ===');
    const found = await client.voiceInTrunks().find(sip.data.id, { include: 'voice_in_trunk_group' });
    const config = found.data.configuration;
    console.log(`Found: ${describe(found.data)}`);
    if (config.type === 'sip_configurations') {
      console.log(`  codecs: ${config.codecs?.join(', ')}`);
      console.log(`  ICE mode: ${config.iceMode}, transport: ${config.transportProtocolId}`);
      console.log(`  rerouting disconnect codes: ${config.reroutingDisconnectCodeIds?.join(', ')}`);
    }

    // Update the SIP trunk: description, point of presence and capacity limit
    console.log('\n=== Updating trunks ===');
    const updatedSip = await client.voiceInTrunks().update({
      id: sip.data.id,
      description: 'Updated SIP trunk',
      pop: Pop.AMS,
      capacityLimit: 20,
    });
    console.log(
      `Updated SIP trunk: description "${updatedSip.data.description}", POP ${updatedSip.data.pop}, ` +
        `capacity limit ${updatedSip.data.capacityLimit}`,
    );

    // Update the PSTN trunk: name and destination number
    const updatedPstn = await client.voiceInTrunks().update({
      id: pstn.data.id,
      name: `Updated PSTN Trunk ${suffix}`,
      configuration: pstnConfiguration({ dst: '12125559876' }),
    });
    console.log(`Updated PSTN trunk: ${describe(updatedPstn.data)}`);
  } finally {
    // Delete both trunks
    for (const id of createdIds) {
      await client.voiceInTrunks().remove(id);
      console.log(`Deleted trunk ${id}`);
    }
  }
}

await main();
