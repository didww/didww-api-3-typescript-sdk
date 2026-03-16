import type { AnyResourceConfig } from '../resources/base.js';
import type { HttpClient } from './read-only-repository.js';
import { BaseRepository } from './base-repository.js';

export class CreateOnlyRepository<T, TWrite = Partial<T>> extends BaseRepository<T, TWrite> {
  constructor(client: HttpClient, meta: AnyResourceConfig) {
    super(client, { ...meta, operations: ['list', 'find', 'create', 'remove'] as const });
  }
}
