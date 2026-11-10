import { describe, expect, it } from 'vitest';

import {
  ContainerEngine,
  EnvironmentType,
  PlatformType,
} from '@/react/portainer/environments/types';

import {
  getDashboardRoute,
  getEnvironmentTypeIcon,
  getPlatformType,
  getPlatformTypeName,
  IconSizeClass,
  isDockerAPIEnvironment,
  isDockerEnvironment,
  isLocalDockerEnvironment,
  isLocalEnvironment,
} from './index';

function dockerEnv(overrides: Record<string, unknown> = {}) {
  return {
    Id: 1,
    Type: EnvironmentType.Docker,
    URL: 'unix:///var/run/docker.sock',
    Edge: { AsyncMode: false },
    EdgeID: '',
    ...overrides,
  } as never;
}

describe('environments utils KEEP docker helpers', () => {
  it('classifies docker platform types and names', () => {
    expect(getPlatformType(EnvironmentType.Docker)).toBe(PlatformType.Docker);
    expect(getPlatformType(EnvironmentType.AgentOnDocker)).toBe(
      PlatformType.Docker
    );
    expect(isDockerEnvironment(EnvironmentType.Docker)).toBe(true);
    expect(getPlatformTypeName(EnvironmentType.Docker)).toBe('Docker');
  });

  it('detects local docker socket and API endpoints', () => {
    expect(isLocalDockerEnvironment('unix:///var/run/docker.sock')).toBe(true);
    expect(isLocalDockerEnvironment('npipe://./pipe/docker_engine')).toBe(true);
    expect(isLocalDockerEnvironment('tcp://1.2.3.4:2375')).toBe(false);
    expect(isLocalEnvironment(dockerEnv())).toBe(true);
    expect(
      isDockerAPIEnvironment(
        dockerEnv({ URL: 'tcp://1.2.3.4:2375', Type: EnvironmentType.Docker })
      )
    ).toBe(true);
    expect(isDockerAPIEnvironment(dockerEnv())).toBe(false);
  });

  it('returns docker dashboard route and icon', () => {
    expect(getDashboardRoute(dockerEnv())).toEqual({
      to: 'docker.dashboard',
      params: { endpointId: 1 },
    });
    expect(getEnvironmentTypeIcon(EnvironmentType.Docker)).toBeTruthy();
    expect(IconSizeClass.sm).toContain('h-3.5');
  });
});

describe('REQ-TAI-002 Kubernetes dashboard is gone', () => {
  it('routes a leftover Kubernetes environment to its details page', () => {
    expect(
      getDashboardRoute(
        dockerEnv({ Id: 3, Type: EnvironmentType.AgentOnKubernetes })
      )
    ).toEqual({
      to: 'portainer.endpoints.endpoint',
      params: { id: 3 },
    });
  });
});

describe('REQ-TAI-008 Azure dashboard is gone', () => {
  it('routes a leftover Azure environment to its details page', () => {
    expect(
      getDashboardRoute(dockerEnv({ Id: 4, Type: EnvironmentType.Azure }))
    ).toEqual({
      to: 'portainer.endpoints.endpoint',
      params: { id: 4 },
    });
  });
});
