import { describe, expect, it } from 'vitest';

import { StackType } from '@/react/common/stacks/types';

import * as utils from './utils';

const { getDeployedStackLink, getSourceLink } = utils;

describe('workflow link helpers', () => {
  it('REQ-TAI-011 builds source item links and no workflow item links', () => {
    expect(utils).not.toHaveProperty('getWorkflowLink');
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
