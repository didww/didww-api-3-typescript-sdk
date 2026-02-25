/**
 * DID Reservations: create, list, and delete.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/did-reservations.ts
 */
import { DidwwClient, Environment, ref, isIncluded } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get an available DID to reserve
  const available = await client.availableDids().list({ page: { size: 1 } });
  if (available.data.length === 0) {
    console.log('No available DIDs found');
    return;
  }
  const ad = available.data[0];
  console.log(`Available DID: ${ad.number} (${ad.id})`);

  // Create a reservation
  const reservation = await client.didReservations().create({
    description: 'Reserved for testing',
    availableDid: ref('available_dids', ad.id),
  });
  console.log(`\nCreated reservation: ${reservation.data.id}`);
  console.log(`  description: ${reservation.data.description}`);
  console.log(`  expireAt: ${reservation.data.expireAt}`);

  // List reservations with included available DID
  const reservations = await client.didReservations().list({
    include: 'available_did',
  });
  console.log(`\nAll reservations (${reservations.data.length}):`);
  for (const r of reservations.data) {
    const adRef = r.availableDid;
    const adNumber = adRef && isIncluded(adRef) ? adRef.number : 'unknown';
    console.log(`  ${r.id} number=${adNumber} expires=${r.expireAt}`);
  }

  // Find the reservation by id
  const found = await client.didReservations().find(reservation.data.id);
  console.log(`\nFound reservation: ${found.data.id}`);
  console.log(`  description: ${found.data.description}`);

  // Delete reservation
  await client.didReservations().remove(reservation.data.id);
  console.log('Deleted reservation');
}

main().catch(console.error);
