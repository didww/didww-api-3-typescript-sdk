import { defineResource } from './base.js';
import type { ExportType, ExportStatus, CallbackMethod } from '../enums.js';

export interface Export {
  id: string;
  type: 'exports';
  exportType: ExportType;
  url: string | null;
  callbackUrl: string | null;
  callbackMethod: CallbackMethod | null;
  status: ExportStatus;
  filters: Record<string, unknown>;
  createdAt: string;
}

export interface ExportWrite {
  exportType?: ExportType;
  filters?: Record<string, unknown>;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
}

export const EXPORT_RESOURCE = defineResource<Export, ExportWrite>()({
  type: 'exports',
  path: 'exports',
  writableKeys: ['exportType', 'filters', 'callbackUrl', 'callbackMethod'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
