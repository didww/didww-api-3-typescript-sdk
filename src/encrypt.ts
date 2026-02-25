import { createCipheriv, createHash, publicEncrypt, randomBytes, constants } from 'node:crypto';
import type { DidwwClient } from './client.js';

export class Encrypt {
  private readonly client: DidwwClient;
  private publicKeyPems!: [string, string];
  private _fingerprint!: string;
  private initPromise: Promise<void> | null = null;

  constructor(client: DidwwClient) {
    this.client = client;
  }

  async init(): Promise<void> {
    const keys = await this.client.publicKeys().list();
    if (keys.data.length < 2) {
      throw new Error('Expected at least 2 public keys from API');
    }
    this.publicKeyPems = [keys.data[0].key, keys.data[1].key];
    this._fingerprint = calculateFingerprint(this.publicKeyPems);
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    return this.initPromise;
  }

  async encrypt(data: Buffer): Promise<Buffer> {
    await this.ensureInitialized();
    return encryptWithKeys(data, this.publicKeyPems);
  }

  async getFingerprint(): Promise<string> {
    await this.ensureInitialized();
    return this._fingerprint;
  }

  async reset(): Promise<void> {
    this.initPromise = null;
    await this.ensureInitialized();
  }
}

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
