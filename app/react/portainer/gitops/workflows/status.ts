import {
  WorkflowStatus,
  WorkflowPhaseStatus,
  WorkflowStatusObject,
} from './types';

const STATUS_PRIORITY: Record<WorkflowStatus, number> = {
  error: 4,
  syncing: 3,
  paused: 2,
  healthy: 1,
  unknown: 0,
};

export function worstPhaseStatus(
  phases: WorkflowPhaseStatus[]
): WorkflowPhaseStatus {
  return phases.reduce((worst, phase) =>
    STATUS_PRIORITY[phase.status || 'unknown'] >
    STATUS_PRIORITY[worst.status || 'unknown']
      ? phase
      : worst
  );
}

export function effectiveWorkflowStatus(item: {
  status: WorkflowStatusObject;
}): WorkflowPhaseStatus {
  return worstPhaseStatus([
    item.status.source,
    item.status.artifact,
    item.status.target,
  ]);
}
