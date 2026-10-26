import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { StubServer, type Handler, type Reply } from './http-stub.js';

const FIXTURES = join(__dirname, '..', 'fixtures', 'prices');

/** A prices fixture as bytes. */
export function pricesFixture(path: string): Buffer {
  return readFileSync(join(FIXTURES, path));
}

/** Answers POST /token with access-token-1, access-token-2, ... for the audience requested. */
export function mintForRequestedAudience(): Handler {
  let n = 0;
  return (req, res) => {
    n++;
    const { aud } = JSON.parse(req.body.toString('utf8')) as { aud: string[] };
    const body = JSON.stringify({
      access_token: `access-token-${n}`,
      token_type: 'Bearer',
      expires_in: 900,
      aud,
      scope: 'full',
      api_version: '2026-10-22',
    });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  };
}

/** A stub server that mints tokens for any audience and answers `route` with `replies`. */
export async function startPricesStub(route?: string, ...replies: Reply[]): Promise<StubServer> {
  const stub = await StubServer.start();
  stub.on('POST /token', mintForRequestedAudience());
  if (route !== undefined) stub.on(route, ...replies);
  return stub;
}

/** The audiences of every token request sent to `stub`, in order. */
export function mintedAudiences(stub: StubServer): string[] {
  return stub.hits('POST /token').flatMap((r) => (JSON.parse(r.body.toString('utf8')) as { aud: string[] }).aud);
}

/** The requests sent to `stub`, token requests excepted. */
export function serviceRequests(stub: StubServer) {
  return stub.requests.filter((r) => r.path !== '/token');
}

export const JSONAPI_HEADERS = { 'Content-Type': 'application/vnd.api+json' };

/** Resolves with the rejection of `promise`, which must reject with an Error. */
export async function failure(promise: Promise<unknown>): Promise<Error> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}
