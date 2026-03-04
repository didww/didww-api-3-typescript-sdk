import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import nock from 'nock';

const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');
const BASE_URL = 'https://sandbox-api.didww.com';

interface VcrInteraction {
  request: {
    body: string | null;
    headers: Record<string, string[]>;
    method: string;
    uri: string;
  };
  response: {
    body: {
      string: string;
    };
    headers: Record<string, string[]>;
    status: {
      code: number;
      message: string;
    };
  };
}

interface VcrCassette {
  interactions: VcrInteraction[];
}

export function loadCassette(fixturePath: string): nock.Scope {
  const fullPath = resolve(FIXTURES_DIR, fixturePath);
  const content = readFileSync(fullPath, 'utf-8');
  const cassette = parse(content) as VcrCassette;

  const scope = nock(BASE_URL);

  for (const interaction of cassette.interactions) {
    const url = new URL(interaction.request.uri);
    const path = url.pathname + url.search;
    const method = interaction.request.method.toLowerCase();
    const statusCode = interaction.response.status.code;

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(interaction.response.body.string);
    } catch {
      responseBody = interaction.response.body.string;
    }

    const responseHeaders: Record<string, string> = {};
    if (interaction.response.headers) {
      for (const [key, values] of Object.entries(interaction.response.headers)) {
        responseHeaders[key] = Array.isArray(values) ? values[0] : values;
      }
    }

    let requestBody: nock.RequestBodyMatcher | undefined;
    if (interaction.request.body) {
      try {
        requestBody = JSON.parse(interaction.request.body);
      } catch {
        requestBody = interaction.request.body;
      }
    }

    switch (method) {
      case 'get':
        scope.get(path).reply(statusCode, responseBody, responseHeaders);
        break;
      case 'post':
        if (requestBody) {
          scope.post(path, requestBody).reply(statusCode, responseBody, responseHeaders);
        } else {
          scope.post(path).reply(statusCode, responseBody, responseHeaders);
        }
        break;
      case 'patch':
        if (requestBody) {
          scope.patch(path, requestBody).reply(statusCode, responseBody, responseHeaders);
        } else {
          scope.patch(path).reply(statusCode, responseBody, responseHeaders);
        }
        break;
      case 'delete':
        scope.delete(path).reply(statusCode, responseBody, responseHeaders);
        break;
    }
  }

  return scope;
}

export function cleanupNock(): void {
  nock.cleanAll();
}
