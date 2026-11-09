import { describe, it, expect } from 'vitest';

import {
  PortainerEndpointTypes,
  PortainerEndpointCreationTypes,
  PortainerEndpointConnectionTypes,
} from './models';

describe('REQ-ENV-01 PortainerEndpointTypes', () => {
  it('exposes frozen Docker and related environment type iota values', () => {
    expect(PortainerEndpointTypes.DockerEnvironment).toBe(1);
    expect(PortainerEndpointTypes.AgentOnDockerEnvironment).toBe(2);
    expect(PortainerEndpointTypes.AzureEnvironment).toBe(3);
    expect(PortainerEndpointTypes.EdgeAgentOnDockerEnvironment).toBe(4);
    expect(PortainerEndpointTypes.KubernetesLocalEnvironment).toBe(5);
    expect(PortainerEndpointTypes.AgentOnKubernetesEnvironment).toBe(6);
    expect(PortainerEndpointTypes.EdgeAgentOnKubernetesEnvironment).toBe(7);
    expect(Object.isFrozen(PortainerEndpointTypes)).toBe(true);
  });
});

describe('REQ-ENV-11 PortainerEndpointCreationTypes', () => {
  it('exposes frozen creation-type iota values for local Docker and related wizards', () => {
    expect(PortainerEndpointCreationTypes.LocalDockerEnvironment).toBe(1);
    expect(PortainerEndpointCreationTypes.AgentEnvironment).toBe(2);
    expect(PortainerEndpointCreationTypes.AzureEnvironment).toBe(3);
    expect(PortainerEndpointCreationTypes.EdgeAgentEnvironment).toBe(4);
    expect(PortainerEndpointCreationTypes.LocalKubernetesEnvironment).toBe(5);
    expect(Object.isFrozen(PortainerEndpointCreationTypes)).toBe(true);
  });
});

describe('REQ-ENV-04 PortainerEndpointConnectionTypes', () => {
  it('exposes frozen connection-type values including DOCKER_LOCAL', () => {
    expect(PortainerEndpointConnectionTypes.DOCKER_LOCAL).toBe(1);
    expect(PortainerEndpointConnectionTypes.KUBERNETES_LOCAL).toBe(2);
    expect(PortainerEndpointConnectionTypes.REMOTE).toBe(3);
    expect(PortainerEndpointConnectionTypes.AZURE).toBe(4);
    expect(PortainerEndpointConnectionTypes.AGENT).toBe(5);
    expect(PortainerEndpointConnectionTypes.EDGE).toBe(6);
    expect(Object.isFrozen(PortainerEndpointConnectionTypes)).toBe(true);
  });
});
