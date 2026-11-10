import {
  WorkflowsWorkflowPhaseStatus,
  WorkflowsWorkflowStatusObject,
} from '@api/types.gen';

import { WorkflowPhaseStatus, WorkflowStatusObject } from '../types';

export function toStatusObject(
  statusObj: WorkflowsWorkflowStatusObject | undefined
): WorkflowStatusObject {
  return {
    artifact: toPhaseStatus(statusObj?.artifact),
    source: toPhaseStatus(statusObj?.source),
    target: toPhaseStatus(statusObj?.target),
  };
}

function toPhaseStatus(
  status: WorkflowsWorkflowPhaseStatus | undefined
): WorkflowPhaseStatus {
  return {
    status: status?.status || 'unknown',
    error: status?.error,
  };
}
