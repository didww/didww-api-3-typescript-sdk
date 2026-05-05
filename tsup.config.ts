import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  // Inline the version at build time so the runtime never has to
  // load package.json. createRequire(import.meta.url) fails in CJS
  // because tsup compiles import.meta to an empty object.
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
