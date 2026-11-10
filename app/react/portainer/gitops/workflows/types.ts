export type WorkflowStatus =
  | 'healthy'
  | 'error'
  | 'syncing'
  | 'paused'
  | 'unknown';
export type WorkflowType = 'stack';
export type DeploymentPlatform =
  | 'dockerStandalone'
  | 'dockerSwarm'
  | 'kubernetes';

export interface WorkflowPhaseStatus {
  status: WorkflowStatus;
  error?: string;
}

export interface WorkflowStatusObject {
  source: WorkflowPhaseStatus;
  artifact: WorkflowPhaseStatus;
  target: WorkflowPhaseStatus;
}

export interface WorkflowTarget {
  endpointId?: number;
  namespace?: string;
}

export interface WorkflowFileRef {
  sourceId: number;
  path: string;
  ref: string;
}
