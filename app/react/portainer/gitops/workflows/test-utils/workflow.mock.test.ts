import {
  getWorkflowMock,
  mockWorkflowArtifactError,
  mockWorkflowEdgeMixed,
  mockWorkflowEmpty,
  mockWorkflowHealthy,
  mockWorkflowMultiArtifact,
  mockWorkflowSourceError,
  mockWorkflowTargetError,
} from './workflow.mock';

describe('workflow.mock', () => {
  it('exposes the fixture workflows by id', () => {
    expect(getWorkflowMock(1)).toBe(mockWorkflowHealthy);
    expect(getWorkflowMock(2)).toBe(mockWorkflowSourceError);
    expect(getWorkflowMock(3)).toBe(mockWorkflowArtifactError);
    expect(getWorkflowMock(4)).toBe(mockWorkflowTargetError);
    expect(getWorkflowMock(5)).toBe(mockWorkflowEdgeMixed);
    expect(getWorkflowMock(6)).toBe(mockWorkflowMultiArtifact);
    expect(getWorkflowMock(7)).toBe(mockWorkflowEmpty);
    expect(getWorkflowMock(999)).toBeUndefined();
  });

  it('keeps healthy fixture docker-facing', () => {
    expect(mockWorkflowHealthy.artifacts[0]?.platform).toBe('dockerStandalone');
    expect(mockWorkflowHealthy.status.source.status).toBe('healthy');
  });
});
