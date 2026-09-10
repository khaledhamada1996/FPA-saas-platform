export const IMPORT_STATUSES = [
  "uploaded",
  "validating",
  "mapping",
  "preview",
  "importing",
  "reconciled",
  "published",
  "failed",
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export interface ImportSummary {
  importId: string;
  organizationId: string;
  status: ImportStatus;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warningCount: number;
}
