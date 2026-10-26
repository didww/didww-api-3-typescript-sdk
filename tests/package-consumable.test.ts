import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';

// End-to-end regression test that exercises the published shape of the
// package, not the source tree. It runs `npm pack` to build a real
// tarball, installs it into a fresh temp project, then has Node import
// `@didww/sdk` (both ESM and CJS), construct a client and report the
// public exports.
//
// Catches every failure mode that bites downstream consumers but stays
// invisible to in-tree vitest:
//
//   - package.json `main` / `module` / `types` / `exports` paths that
//     point at non-existent files (v3.0.0 incident: `./dist/cjs/...`
//     declared, only `./dist/...` emitted).
//   - tsup compiling `import.meta.url` to an empty object, so the CJS
//     bundle throws ERR_INVALID_ARG_VALUE on require (v3.0.0 incident
//     #2 in client.ts).
//   - `files` array forgetting to include the dist output.
//   - Missing transitive dependency in `dependencies`.
//   - ESM/CJS interop breakage at module-load time.
//   - A constructor path (token store default, logger, URL validation)
//     that breaks in one of the two builds only.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Runs in the consumer project as probe.mjs (ESM) and probe.cjs (CJS);
// `m` is the loaded module.
const PROBE = `
const { inspect } = require('node:util');
const report = {};
for (const name of [
  'DidwwClient', 'MemoryTokenStore', 'AccessToken', 'PricesService', 'PriceFileReader', 'JsonNumber',
  'DidwwError', 'DidwwApiError', 'DidwwClientError', 'DidwwAuthError', 'DidwwPricesError',
  'readPriceFile', 'smsHttpInConfiguration', 'isSenderIdVerificationActive',
]) report[name] = typeof m[name];
report.defaultApiVersion = m.DEFAULT_API_VERSION;
report.scopes = [m.Scope.READ, m.Scope.FULL];
report.kinds = [m.AuthErrorKind.INVALID_CLIENT, m.PricesErrorKind.PRICE_NOT_FOUND];
report.errorBase = [m.DidwwApiError, m.DidwwClientError, m.DidwwAuthError, m.DidwwPricesError].every(
  (E) => E.prototype instanceof m.DidwwError,
);
const sandbox = new m.DidwwClient({ apiKey: 'consumer-secret-key' });
const production = new m.DidwwClient({
  apiKey: 'consumer-secret-key',
  environment: m.Environment.PRODUCTION,
  scope: m.Scope.READ,
  tokenStore: new m.MemoryTokenStore(),
  logger: { warn() {} },
});
report.environments = [sandbox.environment, production.environment];
report.apiVersion = sandbox.apiVersion;
report.prices = sandbox.voiceInPrices() instanceof m.PricesService;
report.smsTrunks = typeof sandbox.smsTrunks().list;
report.keyHidden = !inspect(sandbox).includes('consumer-secret-key') && !JSON.stringify(production).includes('consumer-secret-key');
try {
  new m.DidwwClient({ apiKey: 'k', fetch: () => undefined });
  report.fetchOption = 'accepted';
} catch (e) {
  report.fetchOption = e instanceof m.DidwwClientError ? 'rejected' : String(e);
}
console.log(JSON.stringify(report));
`;

const EXPECTED = {
  DidwwClient: 'function',
  MemoryTokenStore: 'function',
  AccessToken: 'function',
  PricesService: 'function',
  PriceFileReader: 'function',
  JsonNumber: 'function',
  DidwwError: 'function',
  DidwwApiError: 'function',
  DidwwClientError: 'function',
  DidwwAuthError: 'function',
  DidwwPricesError: 'function',
  readPriceFile: 'function',
  smsHttpInConfiguration: 'function',
  isSenderIdVerificationActive: 'function',
  defaultApiVersion: '2026-10-22',
  scopes: ['read', 'full'],
  kinds: ['invalid_client', 'price_not_found'],
  errorBase: true,
  environments: ['https://sandbox-api.didww.com/v3/', 'https://api.didww.com/v3/'],
  apiVersion: '2026-10-22',
  prices: true,
  smsTrunks: 'function',
  keyHidden: true,
  fetchOption: 'rejected',
};

// Runs in the consumer project as cross.mjs: each copy's client reads a
// token built by the other copy from a shared store, without a mint.
const CROSS = `
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const copies = { esm: await import('@didww/sdk'), cjs: require('@didww/sdk') };
const hits = [];
const server = http.createServer((req, res) => {
  hits.push(req.method + ' ' + req.url + ' ' + (req.headers.authorization ?? ''));
  res.writeHead(200, { 'Content-Type': 'application/vnd.api+json' });
  res.end(JSON.stringify({ data: { id: 'b1', type: 'balances', attributes: {} } }));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const report = {};
for (const [reader, builder] of [['esm', 'cjs'], ['cjs', 'esm']]) {
  hits.length = 0;
  const token = new copies[builder].AccessToken({ accessToken: builder + '-token', expiresIn: 900, mintedAt: new Date() });
  const warnings = [];
  const client = new copies[reader].DidwwClient({
    apiKey: 'k',
    baseUrl: url + '/v3',
    authUrl: url,
    tokenStore: { get: () => token, set() {}, delete() {} },
    logger: { warn: (message) => warnings.push(message) },
  });
  await client.balance().find();
  report[reader] = { hits: [...hits], warnings };
}
server.close();
console.log(JSON.stringify(report));
`;

// Runs in the consumer project as numbers.mjs: each copy's client sends a
// JsonNumber built by the other copy.
const NUMBERS = `
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const copies = { esm: await import('@didww/sdk'), cjs: require('@didww/sdk') };
const bodies = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    bodies.push(body);
    res.writeHead(200, { 'Content-Type': 'application/vnd.api+json' });
    res.end('{"data":null}');
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const report = {};
for (const [sender, builder] of [['esm', 'cjs'], ['cjs', 'esm']]) {
  bodies.length = 0;
  const client = new copies[sender].DidwwClient({ apiKey: 'k', baseUrl: url + '/v3', authUrl: url });
  await client.post('public_keys', { n: new copies[builder].JsonNumber('1.10') });
  report[sender] = bodies[0];
}
server.close();
console.log(JSON.stringify(report));
`;

describe('published package is consumable end-to-end', () => {
  let consumerDir: string;

  beforeAll(() => {
    execSync('npm run build', { cwd: root, stdio: 'pipe' });

    // Pack into the SDK directory. `npm pack` writes a tarball whose
    // name embeds the version; capture it from the directory listing
    // rather than parsing the command output.
    execSync('npm pack', { cwd: root, stdio: 'pipe' });
    const tarball = readdirSync(root)
      .filter((f) => f.startsWith('didww-sdk-') && f.endsWith('.tgz'))
      .sort()
      .pop();
    if (!tarball) throw new Error('npm pack did not produce a tarball');

    // Fresh empty project — no test pollution from other consumers.
    consumerDir = mkdtempSync(join(tmpdir(), 'didww-consumer-'));
    writeFileSync(join(consumerDir, 'package.json'), '{"type":"module","private":true}');
    try {
      execSync(`npm install ${join(root, tarball)}`, { cwd: consumerDir, stdio: 'pipe' });
    } finally {
      // Tarball cleanup so we don't leave it in the repo working tree.
      unlinkSync(join(root, tarball));
    }

    writeFileSync(
      join(consumerDir, 'probe.mjs'),
      `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst m = await import('@didww/sdk');\n${PROBE}`,
    );
    writeFileSync(join(consumerDir, 'probe.cjs'), `const m = require('@didww/sdk');\n${PROBE}`);
    writeFileSync(join(consumerDir, 'cross.mjs'), CROSS);
    writeFileSync(join(consumerDir, 'numbers.mjs'), NUMBERS);
  }, 120_000);

  it('ESM: import("@didww/sdk") exposes DidwwClient', () => {
    const out = execSync(
      `node --input-type=module -e "import('@didww/sdk').then(m => console.log(typeof m.DidwwClient))"`,
      { cwd: consumerDir, encoding: 'utf8' },
    ).trim();
    expect(out).toBe('function');
  });

  it('CJS: require("@didww/sdk") exposes DidwwClient', () => {
    const out = execSync(`node -e "console.log(typeof require('@didww/sdk').DidwwClient)"`, {
      cwd: consumerDir,
      encoding: 'utf8',
    }).trim();
    expect(out).toBe('function');
  });

  it('ESM: constructs a client and exposes the public API', () => {
    const out = execSync('node probe.mjs', { cwd: consumerDir, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual(EXPECTED);
  });

  it('CJS: constructs a client and exposes the public API', () => {
    const out = execSync('node probe.cjs', { cwd: consumerDir, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual(EXPECTED);
  });

  it('ESM and CJS: a client accepts a stored token built by the other copy', () => {
    const out = execSync('node cross.mjs', { cwd: consumerDir, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({
      esm: { hits: ['GET /v3/balance Bearer cjs-token'], warnings: [] },
      cjs: { hits: ['GET /v3/balance Bearer esm-token'], warnings: [] },
    });
  });

  it('ESM and CJS: a client sends a JsonNumber built by the other copy as a number', () => {
    const out = execSync('node numbers.mjs', { cwd: consumerDir, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({ esm: '{"n":1.10}', cjs: '{"n":1.10}' });
  });
});
