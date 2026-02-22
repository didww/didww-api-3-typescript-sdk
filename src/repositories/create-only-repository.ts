import type { ResourceMeta } from '../resources/base.js';
import type { QueryParams } from '../query-params.js';
import type { ApiResponse } from './types.js';
import type { HttpClient } from './read-only-repository.js';
import { ReadOnlyRepository } from './read-only-repository.js';
import { serializeForCreate } from '../serializer.js';

export class CreateOnlyRepository<T, TWrite = Partial<T>> extends ReadOnlyRepository<T> {
  constructor(client: HttpClient, meta: ResourceMeta<T, TWrite>) {
    super(client, meta);
  }

  async create(resource: TWrite, params?: QueryParams): Promise<ApiResponse<T>> {
    const body = serializeForCreate(this.meta as ResourceMeta<T, TWrite>, resource);
    const response = await this.client.post(this.meta.path, body, params);
    return this.deserializeSingle(response);
  }

  async remove(id: string): Promise<void> {
    await this.client.delete(`${this.meta.path}/${id}`);
  }
}
