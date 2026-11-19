/**
 * Identities, addresses and proofs: creates an identity (with its birth country,
 * 2026-04-16) and an address, encrypts and uploads a file for each, attaches a
 * proof to the identity and to the address, prints their verified flags and
 * deletes the address, the identity and the uploaded files, also when a step fails.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/identity-address-proofs.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DidwwClient, Encrypt, Environment, IdentityType, isIncluded, ref } from '../src/index.js';
import type { Country, ProofType, ResourceRef } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function attachProof(proofType: ProofType | undefined, entity: ResourceRef, fileId: string) {
  if (!proofType) {
    console.log(`No proof type for ${entity.type}; no proof is created`);
    return;
  }
  const proof = await client.proofs().create(
    {
      proofType: ref('proof_types', proofType.id),
      entity,
      files: [ref('encrypted_files', fileId)],
    },
    { include: 'proof_type' },
  );
  const typeName = isIncluded<ProofType>(proof.data.proofType) ? proof.data.proofType.name : proofType.id;
  console.log(`Created proof for ${entity.type}: ${proof.data.id} (type: ${typeName})`);
}

async function main() {
  // A country for the identity and the address
  const countries = await client.countries().list({ filter: { iso: 'US' } });
  const country = countries.data[0];
  if (!country) {
    throw new Error('Country US not found');
  }
  console.log(`Using country: ${country.name} (${country.id})`);

  // Proof types: one for a personal identity, one for an address
  const proofTypes = await client.proofTypes().list();
  const identityProofType = proofTypes.data.find((pt) => pt.entityType === IdentityType.PERSONAL);
  const addressProofType = proofTypes.data.find((pt) => pt.entityType === 'address');
  console.log(`Identity proof type: ${identityProofType ? identityProofType.name : 'none found'}`);
  console.log(`Address proof type: ${addressProofType ? addressProofType.name : 'none found'}`);

  const pdf = readFileSync(resolve(__dirname, 'sample.pdf'));
  const enc = new Encrypt(client);

  let identityId: string | undefined;
  let addressId: string | undefined;
  const fileIds: string[] = [];
  try {
    // Create an identity
    const identity = await client.identities().create(
      {
        identityType: IdentityType.PERSONAL,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '12125551234',
        idNumber: 'AB123456',
        country: ref('countries', country.id),
        birthCountry: ref('countries', country.id),
      },
      { include: 'country,birth_country' },
    );
    identityId = identity.data.id;
    console.log(`\nCreated identity: ${identityId} (${identity.data.firstName} ${identity.data.lastName})`);
    if (isIncluded<Country>(identity.data.country)) console.log(`  Country: ${identity.data.country.name}`);
    if (isIncluded<Country>(identity.data.birthCountry)) {
      console.log(`  Birth country: ${identity.data.birthCountry.name}`);
    }

    // Create an address of the identity
    const address = await client.addresses().create({
      cityName: 'New York',
      postalCode: '10001',
      address: '123 Main St',
      description: 'Example address',
      country: ref('countries', country.id),
      identity: ref('identities', identityId),
    });
    addressId = address.data.id;
    console.log(`Created address: ${addressId} (${address.data.address})`);

    // Encrypt and upload the file once per proof: one file per request
    const fingerprint = await enc.getFingerprint();
    for (const label of ['identity_proof', 'address_proof']) {
      const id = await client.uploadEncryptedFile(fingerprint, {
        data: await enc.encrypt(pdf),
        description: `${label}.pdf`,
        filename: `${label}.pdf.enc`,
      });
      fileIds.push(id);
      console.log(`Uploaded encrypted file: ${id} (${label}.pdf)`);
    }

    // Attach a proof to the identity and to the address
    await attachProof(identityProofType, ref('identities', identityId), fileIds[0]);
    await attachProof(addressProofType, ref('addresses', addressId), fileIds[1]);

    // Read the verified flags: DIDWW sets them once it has checked the proofs
    const identityNow = await client.identities().find(identityId);
    const addressNow = await client.addresses().find(addressId);
    console.log(`\nIdentity ${identityId}: verified=${identityNow.data.verified}`);
    console.log(`Address ${addressId}: verified=${addressNow.data.verified}`);
  } finally {
    console.log('\nCleaning up...');
    if (addressId) {
      await client.addresses().remove(addressId);
      console.log(`  Deleted address: ${addressId}`);
    }
    if (identityId) {
      await client.identities().remove(identityId);
      console.log(`  Deleted identity: ${identityId}`);
    }
    for (const id of fileIds) {
      await client.encryptedFiles().remove(id);
      console.log(`  Deleted encrypted file: ${id}`);
    }
  }
}

await main();
