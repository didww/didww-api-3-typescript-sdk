import { defineResource } from './base.js';
import type { ExportType, ExportStatus, CallbackMethod } from '../enums.js';

export interface ExportFilters {
  /** ISO 8601 lower bound, INCLUSIVE (time_start >= from). cdr_in / cdr_out only. */
  from?: string;
  /** ISO 8601 upper bound, EXCLUSIVE (time_start < to). cdr_in / cdr_out only. */
  to?: string;
  /** Only for CDR in */
  didNumber?: string;
  /** Only for CDR out */
  voiceOutTrunkId?: string;
}

export interface Export {
  id: string;
  type: 'exports';
  exportType: ExportType;
  url: string | null;
  callbackUrl: string | null;
  callbackMethod: CallbackMethod | null;
  status: ExportStatus;
  filters: ExportFilters;
  createdAt: string;
  externalReferenceId: string | null;
}

export interface ExportWrite {
  exportType?: ExportType;
  filters?: ExportFilters;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  externalReferenceId?: string | null;
}

export const EXPORT_RESOURCE = defineResource<Export, ExportWrite>()({
  type: 'exports',
  path: 'exports',
  writableKeys: ['exportType', 'filters', 'callbackUrl', 'callbackMethod', 'externalReferenceId'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
