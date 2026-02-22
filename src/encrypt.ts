import { createCipheriv, createHash, publicEncrypt, randomBytes, constants } from 'node:crypto';

export function encryptWithKeys(binaryData: Buffer, publicKeyPems: [string, string]): Buffer {
  const aesKey = randomBytes(32);
  const iv = randomBytes(16);

  // Encrypt data with AES-256-CBC
  const cipher = createCipheriv('aes-256-cbc', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(binaryData), cipher.final()]);

  // Encrypt AES key+IV with each RSA public key using OAEP
  const aesCredentials = Buffer.concat([aesKey, iv]);
  const encryptedRsaA = encryptRsaOaep(publicKeyPems[0], aesCredentials);
  const encryptedRsaB = encryptRsaOaep(publicKeyPems[1], aesCredentials);

  return Buffer.concat([encryptedRsaA, encryptedRsaB, encrypted]);
}

export function calculateFingerprint(publicKeyPems: [string, string]): string {
  const fpA = fingerprintFor(publicKeyPems[0]);
  const fpB = fingerprintFor(publicKeyPems[1]);
  return `${fpA}:::${fpB}`;
}

function encryptRsaOaep(pemKey: string, data: Buffer): Buffer {
  return publicEncrypt(
    {
      key: pemKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data,
  );
}

function fingerprintFor(pemKey: string): string {
  // Extract DER from PEM
  const lines = pemKey.split('\n').filter((l) => !l.startsWith('-----'));
  const der = Buffer.from(lines.join(''), 'base64');
  return createHash('sha1').update(der).digest('hex');
}
