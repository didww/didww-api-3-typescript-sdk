import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DidwwClient, Environment, encryptWithKeys, calculateFingerprint } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Read the sample PDF file
  const pdfPath = resolve(__dirname, 'sample.pdf');
  const pdfData = readFileSync(pdfPath);
  console.log(`Read PDF file: ${pdfPath} (${pdfData.length} bytes)`);

  // Encrypt the PDF
  const encrypted = encryptWithKeys(pdfData, publicKeyPems);
  console.log(`Encrypted data size: ${encrypted.length} bytes`);

  // Upload
  const id = await client.uploadEncryptedFile(fingerprint, {
    data: encrypted,
    description: 'Sample PDF document',
    filename: 'sample.pdf.enc',
  });
  console.log('Uploaded file ID:', id);

  // Verify the uploaded file
  const files = await client.encryptedFiles().list();
  console.log(`\nTotal encrypted files: ${files.data.length}`);
}

main().catch(console.error);
