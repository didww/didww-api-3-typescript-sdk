import type { ResourceMeta } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import type { ApiResponse } from './types.js';
import type { HttpClient } from './read-only-repository.js';
import { deserialize } from '../serializer.js';

export class SingletonRepository<T> {
  constructor(
    private readonly client: HttpClient,
    private readonly meta: ResourceMeta<T>,
  ) {}

  async find(params?: QueryParams): Promise<ApiResponse<T>> {
    const body = await this.client.get(this.meta.path, params);
    const result = deserialize<T>(body);
    return { data: result.data as T, meta: result.meta, links: result.links };
  }
}
