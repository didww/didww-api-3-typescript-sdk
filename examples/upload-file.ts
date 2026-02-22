import { readFileSync } from 'node:fs';
import { DidwwClient, Environment, encryptWithKeys, calculateFingerprint, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get public keys
  const keys = await client.publicKeys().list();
  if (keys.data.length < 2) {
    console.log('Not enough public keys available');
    return;
  }

  const publicKeyPems: [string, string] = [keys.data[0].key, keys.data[1].key];
  const fingerprint = calculateFingerprint(publicKeyPems);
  console.log('Fingerprint:', fingerprint);

  // Encrypt a file
  const fileData = readFileSync('path/to/document.pdf');
  const encrypted = encryptWithKeys(fileData, publicKeyPems);

  // Upload
  const ids = await client.uploadEncryptedFiles(fingerprint, [
    { name: 'document.pdf.enc', data: encrypted },
  ]);
  console.log('Uploaded file IDs:', ids);

  // Create a proof with the uploaded file
  const proof = await client.proofs().create({
    proof_type: ref('proof_types', 'some-proof-type-id'),
    entity: ref('identities', 'some-identity-id'),
    files: ids.map(id => ref('encrypted_files', id)),
  });
  console.log('Proof created:', proof.data.id);
}

main().catch(console.error);
