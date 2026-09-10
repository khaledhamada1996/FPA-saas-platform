export interface AccessContext {
  userId: string;
  organizationId: string;
}

export interface AuthorizationPort {
  can(context: AccessContext, action: string): Promise<boolean>;
  assertCan(context: AccessContext, action: string): Promise<void>;
}

export function requireOrganizationContext(context: AccessContext): AccessContext {
  if (!context.userId || !context.organizationId) {
    throw new Error('Authenticated organization context is required');
  }
  return context;
}
