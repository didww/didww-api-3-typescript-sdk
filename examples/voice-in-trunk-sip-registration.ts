/**
 * End-to-end SIP registration flow on /voice_in_trunks (API 2026-04-16):
 * create with sip_registration enabled → rename → disable by setting `host`
 * → re-enable by toggling the flag. Demonstrates how the SDK keeps the
 * dependent fields (`host`, `port`, `useDidInRuri`) aligned with the
 * server's validation rules. The sandbox trunk is left in place after the
 * script completes.
 *
 * Usage: DIDWW_API_KEY=xxx tsx examples/voice-in-trunk-sip-registration.ts
 */
import {
  DidwwClient,
  Environment,
  sipConfiguration,
  type SipConfiguration,
  Codec,
  TransportProtocol,
} from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== TypeScript SDK — SIP registration flow ===');

  // 1) Create with sip_registration enabled.
  console.log('\n[1/4] Create with sip_registration enabled...');
  const created = await client.voiceInTrunks().create({
    name: `ts-sip-registration-${Date.now()}`,
    priority: 1,
    weight: 100,
    cliFormat: 'e164',
    ringingTimeout: 30,
    configuration: sipConfiguration({
      enabledSipRegistration: true,
      useDidInRuri: true,
      cnamLookup: false,
      codecIds: [Codec.PCMU, Codec.PCMA],
      transportProtocolId: TransportProtocol.UDP,
    }),
  });
  const trunkId = created.data.id!;
  const cfg1 = created.data.configuration as SipConfiguration;
  console.log(`  id=${trunkId}`);
  console.log(`  incomingAuthUsername=${cfg1.incomingAuthUsername}`);
  console.log(`  incomingAuthPassword=${cfg1.incomingAuthPassword}`);

  // 2) Rename — single-field PATCH.
  console.log('\n[2/4] Rename trunk...');
  const renamed = await client.voiceInTrunks().update({
    id: trunkId,
    name: `ts-renamed-${Date.now()}`,
  });
  console.log(`  name=${renamed.data.name}`);

  // 3) Disable sip_registration by setting `host`.
  console.log('\n[3/4] Disable by setting host...');
  await client.voiceInTrunks().update({
    id: trunkId,
    configuration: sipConfiguration({ host: '203.0.113.10' }),
  });
  const fresh3 = await client.voiceInTrunks().find(trunkId);
  const cfg3 = fresh3.data.configuration as SipConfiguration;
  console.log(`  enabledSipRegistration=${cfg3.enabledSipRegistration}`);
  console.log(`  useDidInRuri=${cfg3.useDidInRuri}`);
  console.log(`  host=${cfg3.host}`);
  console.log(`  incomingAuthUsername=${cfg3.incomingAuthUsername}`);

  // 4) Re-enable sip_registration. The SDK should send host=null / port=null on
  //    the wire so the server clears the values it had persisted.
  console.log('\n[4/4] Re-enable by toggling enabledSipRegistration...');
  try {
    await client.voiceInTrunks().update({
      id: trunkId,
      configuration: sipConfiguration({
        enabledSipRegistration: true,
        useDidInRuri: true,
      }),
    });
    const fresh4 = await client.voiceInTrunks().find(trunkId);
    const cfg4 = fresh4.data.configuration as SipConfiguration;
    console.log(`  enabledSipRegistration=${cfg4.enabledSipRegistration}`);
    console.log(`  host=${cfg4.host}`);
    console.log(`  incomingAuthUsername=${cfg4.incomingAuthUsername}`);
    console.log(`\n=== PASS — trunk ${trunkId} left in sandbox ===`);
  } catch (e: any) {
    console.log(`  ✗ FAIL: ${e.message ?? e}`);
    console.log(`\n=== FAIL at re-enable — trunk ${trunkId} left in sandbox ===`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
