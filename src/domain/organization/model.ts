import type { Permission } from "../authorization/permissions";

export const ORGANIZATION_ROLES = ["owner", "admin", "planner", "viewer"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  permissions: ReadonlySet<Permission>;
  createdAt: string;
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function assertOrganizationRole(value: string): OrganizationRole {
  if (!isOrganizationRole(value)) {
    throw new Error(`Invalid organization role: ${value}`);
  }
  return value;
}

export function assertFiscalYearStartMonth(month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Fiscal year start month must be an integer from 1 to 12");
  }
  return month;
}
