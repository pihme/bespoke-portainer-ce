import { describe, it, expect } from 'vitest';

import {
  WorkflowPhaseStatus,
  WorkflowStatus,
  WorkflowStatusObject,
} from './types';
import * as statusModule from './status';
import { effectiveWorkflowStatus, worstPhaseStatus } from './status';

describe('effectiveWorkflowStatus', () => {
  describe('uniform phases', () => {
    it.each<WorkflowStatus>([
      'error',
      'syncing',
      'paused',
      'healthy',
      'unknown',
    ])('all phases %s → %s', (statusType) => {
      const status = makeWorkflowStatus(
        makePhase(statusType),
        makePhase(statusType),
        makePhase(statusType)
      );
      expect(effectiveWorkflowStatus({ status }).status).toBe(statusType);
    });
  });

  describe('priority order', () => {
    it('error beats syncing and healthy', () => {
      const status = makeWorkflowStatus(
        makePhase('error'),
        makePhase('syncing'),
        makePhase('healthy')
      );
      expect(effectiveWorkflowStatus({ status }).status).toBe('error');
    });

    it('syncing beats paused and healthy', () => {
      const status = makeWorkflowStatus(
        makePhase('paused'),
        makePhase('syncing'),
        makePhase('healthy')
      );
      expect(effectiveWorkflowStatus({ status }).status).toBe('syncing');
    });

    it('paused beats healthy and unknown', () => {
      const status = makeWorkflowStatus(
        makePhase('healthy'),
        makePhase('unknown'),
        makePhase('paused')
      );
      expect(effectiveWorkflowStatus({ status }).status).toBe('paused');
    });
  });

  describe('error message', () => {
    it('includes error from the winning phase', () => {
      const status = makeWorkflowStatus(
        makePhase('error', 'git clone failed'),
        makePhase('healthy'),
        makePhase('healthy')
      );
      expect(effectiveWorkflowStatus({ status })).toEqual({
        status: 'error',
        error: 'git clone failed',
      });
    });

    it('no error when winning phase has no error', () => {
      const status = makeWorkflowStatus(
        makePhase('syncing'),
        makePhase('healthy'),
        makePhase('healthy')
      );
      expect(effectiveWorkflowStatus({ status }).error).toBeUndefined();
    });
  });
});

describe('worstPhaseStatus', () => {
  it('returns the sole phase for a single-element list', () => {
    expect(worstPhaseStatus([makePhase('syncing')]).status).toBe('syncing');
  });

  it('picks the highest-priority phase among many', () => {
    const phases = [
      makePhase('unknown'),
      makePhase('healthy'),
      makePhase('paused'),
      makePhase('syncing'),
      makePhase('error'),
    ];
    expect(worstPhaseStatus(phases).status).toBe('error');
  });

  it('carries the error message of the winning phase', () => {
    const phases = [makePhase('healthy'), makePhase('error', 'deploy failed')];
    expect(worstPhaseStatus(phases)).toEqual({
      status: 'error',
      error: 'deploy failed',
    });
  });

  it('is stable when all phases tie on priority', () => {
    const phases = [makePhase('healthy'), makePhase('healthy')];
    expect(worstPhaseStatus(phases).status).toBe('healthy');
  });
});

describe('REQ-TAI-019 workflow view leftovers', () => {
  it('has no workflow target rollup for the removed workflows view', () => {
    expect(statusModule).not.toHaveProperty('computeTargetRollup');
    expect(statusModule).not.toHaveProperty('computeArtifactTargetCount');
  });
});

function makeWorkflowStatus(
  source: WorkflowPhaseStatus,
  artifact: WorkflowPhaseStatus,
  target: WorkflowPhaseStatus
): WorkflowStatusObject {
  return { source, artifact, target };
}

function makePhase(
  status: WorkflowStatus,
  error?: string
): WorkflowPhaseStatus {
  return { status, error };
}
