export type OrganizationStatus = "active" | "suspended";

export interface Organization {
  id: string;
  name: string;
  baseCurrency: string;
  status: OrganizationStatus;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  roleId: string;
  status: "active" | "invited" | "disabled";
}
