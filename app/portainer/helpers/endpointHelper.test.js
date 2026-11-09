import { describe, it, expect } from 'vitest';

import { PortainerEndpointTypes } from '@/portainer/models/endpoint/models';

import EndpointHelper from './endpointHelper.js';

describe('REQ-ENV-04 EndpointHelper Docker and agent classification', () => {
  it('isDockerEndpoint is true for local Docker, agent-on-Docker and Edge-agent-on-Docker', () => {
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.DockerEnvironment })).toBe(true);
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.AgentOnDockerEnvironment })).toBe(true);
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnDockerEnvironment })).toBe(true);
  });

  it('isDockerEndpoint is false for Kubernetes and Azure endpoints', () => {
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.AzureEnvironment })).toBe(false);
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.KubernetesLocalEnvironment })).toBe(false);
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.AgentOnKubernetesEnvironment })).toBe(false);
    expect(EndpointHelper.isDockerEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnKubernetesEnvironment })).toBe(false);
  });

  it('isAgentEndpoint detects agent and Edge-agent Docker and Kubernetes types', () => {
    expect(EndpointHelper.isAgentEndpoint({ Type: PortainerEndpointTypes.AgentOnDockerEnvironment })).toBe(true);
    expect(EndpointHelper.isAgentEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnDockerEnvironment })).toBe(true);
    expect(EndpointHelper.isAgentEndpoint({ Type: PortainerEndpointTypes.AgentOnKubernetesEnvironment })).toBe(true);
    expect(EndpointHelper.isAgentEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnKubernetesEnvironment })).toBe(true);
    expect(EndpointHelper.isAgentEndpoint({ Type: PortainerEndpointTypes.DockerEnvironment })).toBe(false);
  });

  it('isEdgeEndpoint is true only for Edge agent types', () => {
    expect(EndpointHelper.isEdgeEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnDockerEnvironment })).toBe(true);
    expect(EndpointHelper.isEdgeEndpoint({ Type: PortainerEndpointTypes.EdgeAgentOnKubernetesEnvironment })).toBe(true);
    expect(EndpointHelper.isEdgeEndpoint({ Type: PortainerEndpointTypes.DockerEnvironment })).toBe(false);
    expect(EndpointHelper.isEdgeEndpoint({ Type: PortainerEndpointTypes.AgentOnDockerEnvironment })).toBe(false);
  });

  it('mapGroupNameToEndpoint copies the matching group Name onto each endpoint', () => {
    const endpoints = [
      { Id: 1, GroupId: 10 },
      { Id: 2, GroupId: 20 },
      { Id: 3, GroupId: 99 },
    ];
    const groups = [
      { Id: 10, Name: 'local' },
      { Id: 20, Name: 'staging' },
    ];

    EndpointHelper.mapGroupNameToEndpoint(endpoints, groups);

    expect(endpoints[0].GroupName).toBe('local');
    expect(endpoints[1].GroupName).toBe('staging');
    expect(endpoints[2].GroupName).toBeUndefined();
  });
});
