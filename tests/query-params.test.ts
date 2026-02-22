import { describe, it, expect } from 'vitest';
import { buildQueryString } from '../src/query-params.js';

describe('QueryParams', () => {
  it('returns empty string for no params', () => {
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('builds filter params', () => {
    const qs = buildQueryString({ filter: { country_id: 'us' } });
    expect(qs).toBe('?filter[country_id]=us');
  });

  it('builds array filter params', () => {
    const qs = buildQueryString({ filter: { status: ['active', 'pending'] } });
    expect(qs).toBe('?filter[status]=active%2Cpending');
  });

  it('builds include param', () => {
    const qs = buildQueryString({ include: 'country' });
    expect(qs).toBe('?include=country');
  });

  it('builds include array param', () => {
    const qs = buildQueryString({ include: ['country', 'region'] });
    expect(qs).toBe('?include=country%2Cregion');
  });

  it('builds sort param', () => {
    const qs = buildQueryString({ sort: '-name' });
    expect(qs).toBe('?sort=-name');
  });

  it('builds page params', () => {
    const qs = buildQueryString({ page: { number: 2, size: 25 } });
    expect(qs).toBe('?page[number]=2&page[size]=25');
  });

  it('builds combined params', () => {
    const qs = buildQueryString({
      filter: { name: 'test' },
      include: 'country',
      sort: 'name',
      page: { size: 10 },
    });
    expect(qs).toContain('filter[name]=test');
    expect(qs).toContain('include=');
    expect(qs).toContain('sort=');
    expect(qs).toContain('page[size]=10');
  });

  it('builds fields params', () => {
    const qs = buildQueryString({ fields: { countries: 'name,iso' } });
    expect(qs).toBe('?fields[countries]=name%2Ciso');
  });
});
