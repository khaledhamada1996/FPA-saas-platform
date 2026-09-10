export type PlanningArtifactStatus = "draft" | "submitted" | "approved" | "locked";

export interface PlanningVersion {
  id: string;
  organizationId: string;
  name: string;
  status: PlanningArtifactStatus;
  createdBy: string;
  approvedBy?: string;
}

export function canEditPlanningVersion(status: PlanningArtifactStatus): boolean {
  return status === "draft" || status === "submitted";
}

export function canLockPlanningVersion(status: PlanningArtifactStatus): boolean {
  return status === "approved";
}
