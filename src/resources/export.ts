import type { ResourceMeta } from './base.js';
import type { ExportType, ExportStatus, CallbackMethod } from '../enums.js';

export interface Export {
  id: string;
  type: 'exports';
  export_type: ExportType;
  url: string | null;
  callback_url: string | null;
  callback_method: CallbackMethod | null;
  status: ExportStatus;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface ExportWrite {
  export_type?: ExportType;
  filters?: Record<string, unknown>;
  callback_url?: string | null;
  callback_method?: CallbackMethod | null;
}

export const EXPORT_META: ResourceMeta<Export, ExportWrite> = {
  type: 'exports',
  path: 'exports',
  writableKeys: ['export_type', 'filters', 'callback_url', 'callback_method'],
};
