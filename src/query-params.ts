export interface QueryParams {
  filter?: Record<string, string | string[]>;
  include?: string | string[];
  sort?: string | string[];
  page?: { number?: number; size?: number };
  fields?: Record<string, string | string[]>;
}

export function buildQueryString(params?: QueryParams): string {
  if (!params) return '';

  const parts: string[] = [];

  if (params.filter) {
    for (const [key, value] of Object.entries(params.filter)) {
      const v = Array.isArray(value) ? value.join(',') : value;
      parts.push(`filter[${key}]=${encodeURIComponent(v)}`);
    }
  }

  if (params.include) {
    const v = Array.isArray(params.include) ? params.include.join(',') : params.include;
    parts.push(`include=${encodeURIComponent(v)}`);
  }

  if (params.sort) {
    const v = Array.isArray(params.sort) ? params.sort.join(',') : params.sort;
    parts.push(`sort=${encodeURIComponent(v)}`);
  }

  if (params.page) {
    if (params.page.number !== undefined) {
      parts.push(`page[number]=${params.page.number}`);
    }
    if (params.page.size !== undefined) {
      parts.push(`page[size]=${params.page.size}`);
    }
  }

  if (params.fields) {
    for (const [type, value] of Object.entries(params.fields)) {
      const v = Array.isArray(value) ? value.join(',') : value;
      parts.push(`fields[${type}]=${encodeURIComponent(v)}`);
    }
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
