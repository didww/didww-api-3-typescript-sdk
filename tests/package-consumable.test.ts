import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';

// End-to-end regression test that exercises the published shape of the
// package, not the source tree. It runs `npm pack` to build a real
// tarball, installs it into a fresh temp project, then has Node import
// `@didww/sdk` (both ESM and CJS) and report a known export.
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
    execSync(`npm install ${join(root, tarball)}`, { cwd: consumerDir, stdio: 'pipe' });

    // Tarball cleanup so we don't leave it in the repo working tree.
    unlinkSync(join(root, tarball));
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
});
