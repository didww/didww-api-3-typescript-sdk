/**
 * DID History: list DID ownership history (2026-04-16).
 * Records are retained for the last 90 days only.
 *
 * Server-side filters supported:
 *   did_number (eq), action (eq), method (eq),
 *   created_at_gteq, created_at_lteq
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/did-history.ts
 */
import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List most recent DID history events
  console.log('=== Recent DID History ===');
  const events = await client.didHistory().list();
  console.log(`Found ${events.data.length} events in the last 90 days`);

  for (const event of events.data.slice(0, 10)) {
    console.log(`${event.createdAt}  ${event.didNumber.padEnd(16)}  ${event.action.padEnd(28)}  via ${event.method}`);
  }

  // Filter by action
  console.log('\n=== Only "assigned" events ===');
  const assigned = await client.didHistory().list({
    filter: { action: 'assigned' },
  });
  console.log(`Found ${assigned.data.length} assignments`);

  // Filter by a specific DID number
  const firstEvent = events.data[0];
  if (firstEvent) {
    const number = firstEvent.didNumber;
    console.log(`\n=== History for DID ${number} ===`);
    const perNumber = await client.didHistory().list({
      filter: { did_number: number },
    });
    for (const event of perNumber.data) {
      console.log(`${event.createdAt}  ${event.action}  via ${event.method}`);
    }
  }

  // Filter by date range (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`\n=== History since ${sevenDaysAgo} ===`);
  const recent = await client.didHistory().list({
    filter: { created_at_gteq: sevenDaysAgo },
  });
  console.log(`Found ${recent.data.length} events in the last 7 days`);
}

await main();
