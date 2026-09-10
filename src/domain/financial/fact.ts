export const FACT_TYPES = ["actual", "adjustment", "budget", "forecast", "scenario"] as const;
export type FactType = (typeof FACT_TYPES)[number];

export interface FinancialFact {
  organizationId: string;
  legalEntityId: string;
  periodId: string;
  accountId: string;
  amount: string;
  currencyCode: string;
  factType: FactType;
  versionId?: string;
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
  regionId?: string;
  productId?: string;
  projectId?: string;
  sourceImportId?: string;
  sourceRowId?: string;
}

export function assertSupportedFactType(value: string): asserts value is FactType {
  if (!(FACT_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported financial fact type: ${value}`);
  }
}
