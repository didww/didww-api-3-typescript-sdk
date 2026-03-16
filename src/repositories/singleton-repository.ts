import type { AnyResourceConfig } from '../resources/base.js';
import type { HttpClient } from './read-only-repository.js';
import { BaseRepository } from './base-repository.js';

export class SingletonRepository<T> extends BaseRepository<T> {
  constructor(client: HttpClient, meta: AnyResourceConfig) {
    super(client, { ...meta, operations: ['find'] as const, singleton: true as const });
  }
}
