import { describe, expect, it } from 'vitest';

import { StackType } from '@/react/common/stacks/types';

import {
  getDeployedStackLink,
  getSourceLink,
  getWorkflowLink,
} from './utils';

describe('workflow link helpers', () => {
  it('builds workflow and source item links', () => {
    expect(getWorkflowLink({ id: 42 })).toEqual({
      to: 'portainer.gitops.workflows.item',
      params: { workflowId: 42 },
    });
    expect(getSourceLink(7)).toEqual({
      to: 'portainer.gitops.sources.item',
      params: { sourceId: 7 },
    });
  });

  it('links docker standalone/compose stacks to the stack view', () => {
    expect(
      getDeployedStackLink({
        id: 9,
        name: 'web',
        type: 'stack',
        platform: 'dockerStandalone',
        target: { endpointId: 3 },
      })
    ).toEqual({
      to: 'docker.stacks.stack',
      params: {
        endpointId: 3,
        name: 'web',
        id: 9,
        type: StackType.DockerCompose,
        regular: true,
      },
    });
  });

  it('returns null for kubernetes deployments (deferred platform)', () => {
    expect(
      getDeployedStackLink({
        id: 1,
        name: 'app',
        type: 'stack',
        platform: 'kubernetes',
      })
    ).toBeNull();
  });
});
