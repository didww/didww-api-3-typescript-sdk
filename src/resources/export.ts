import type { ResourceMeta } from './base.js';

export interface Export {
  id: string;
  type: 'exports';
  export_type: string;
  url: string | null;
  callback_url: string | null;
  callback_method: string | null;
  status: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface ExportWrite {
  export_type?: string;
  filters?: Record<string, unknown>;
  callback_url?: string | null;
  callback_method?: string | null;
}

export const EXPORT_META: ResourceMeta<Export, ExportWrite> = {
  type: 'exports',
  path: 'exports',
  writableKeys: ['export_type', 'filters', 'callback_url', 'callback_method'],
};
