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

  // Encrypt sample data (in real usage, this would be a file)
  const sampleData = Buffer.from('Sample document content for testing');
  const encrypted = encryptWithKeys(sampleData, publicKeyPems);
  console.log(`Encrypted data size: ${encrypted.length} bytes`);

  // Upload
  const ids = await client.uploadEncryptedFiles(fingerprint, [
    { data: encrypted, description: 'Test document', filename: 'document.pdf.enc' },
  ]);
  console.log('Uploaded file IDs:', ids);

  // Verify the uploaded file
  const files = await client.encryptedFiles().list();
  console.log(`\nTotal encrypted files: ${files.data.length}`);
}

main().catch(console.error);
