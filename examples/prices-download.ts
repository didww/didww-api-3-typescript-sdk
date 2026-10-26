/**
 * Prices download: downloads the Voice IN price file, checks it again with
 * If-Modified-Since, and reads a few rows.
 *
 * The file is written exactly as served, still gzipped, and dated with the
 * answer's Last-Modified. fetch(path) sends the modification time of the file at
 * path as If-Modified-Since, so while the price file is unchanged the second
 * call, and any later run against the same file, is answered 304 and keeps it.
 *
 * The file goes to didww-prices in the user cache directory (%LOCALAPPDATA% on
 * Windows, ~/Library/Caches on macOS, otherwise $XDG_CACHE_HOME or ~/.cache). A
 * missing directory is created for the current user only (0700; the mode is
 * ignored on Windows).
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/prices-download.ts
 */
import { DidwwClient, DidwwPricesError, Environment, PriceFileReader, PricesErrorKind } from '../src/index.js';
import type { PricesService, VoiceInPrice, VoiceInPriceFilters } from '../src/index.js';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FIRST_ROWS = 5;

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

/** %LOCALAPPDATA% on Windows, ~/Library/Caches on macOS, otherwise $XDG_CACHE_HOME or ~/.cache; null if unknown. */
function userCacheDir(): string | null {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA?.trim() || null;
  }
  const mac = process.platform === 'darwin';
  if (!mac) {
    const xdgCache = process.env.XDG_CACHE_HOME?.trim();
    if (xdgCache) return xdgCache;
  }
  const home = homedir();
  if (!home) return null;
  return mac ? join(home, 'Library', 'Caches') : join(home, '.cache');
}

async function fetchFile(prices: PricesService<VoiceInPrice, VoiceInPriceFilters>, path: string) {
  const file = await prices.fetch(path);
  if (file.notModified) {
    console.log('Not modified, file kept');
  } else {
    console.log(`Downloaded ${file.bytesWritten} bytes`);
  }
}

async function run(prices: PricesService<VoiceInPrice, VoiceInPriceFilters>, path: string) {
  console.log('=== HEAD ===');
  const head = await prices.head();
  console.log(`Last-Modified: ${head.lastModified?.toISOString()}, ${head.contentLength} bytes, ${head.filename}`);

  console.log(`\n=== Fetch ${path} ===`);
  await fetchFile(prices, path);

  console.log('\n=== Fetch again ===');
  await fetchFile(prices, path);

  console.log('\n=== First rows ===');
  // Each row is an object keyed by the header line of the file; leaving the loop closes the file
  let count = 0;
  for await (const row of new PriceFileReader(path)) {
    console.log(' ', row);
    if (++count === FIRST_ROWS) break;
  }
}

async function main() {
  const cache = userCacheDir();
  if (cache === null) {
    console.log('No user cache directory: set HOME (LOCALAPPDATA on Windows)');
    return;
  }
  const directory = join(cache, 'didww-prices');
  // Creates the directory when missing; an existing directory is left as it is
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'voice_in_prices.csv.gz');
  console.log(`Price files go to ${directory}`);

  try {
    await run(client.voiceInPrices(), path);
  } catch (e) {
    if (!(e instanceof DidwwPricesError)) throw e;
    if (e.kind === PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED) {
      console.log(`No Voice IN price plan on this account: ${e.message}`);
    } else if (e.kind === PricesErrorKind.SERVICE_UNAVAILABLE) {
      const retry = e.retryAfter !== null ? `retry in ${e.retryAfter} s` : 'retry later';
      console.log(`The price file is not available yet, ${retry}: ${e.message}`);
    } else {
      throw e;
    }
  }
}

main().catch(console.error);
