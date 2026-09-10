export const PERMISSIONS = [
  "workspace.view",
  "workspace.manage",
  "data.view",
  "data.import",
  "budget.view",
  "budget.manage",
  "forecast.view",
  "forecast.manage",
  "scenario.view",
  "scenario.manage",
  "reports.view",
  "reports.export",
  "ai.view",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface AccessContext {
  organizationId: string;
  userId: string;
  permissions: ReadonlySet<Permission>;
}

export function can(context: AccessContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}

export function assertCan(context: AccessContext, permission: Permission): void {
  if (!can(context, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
