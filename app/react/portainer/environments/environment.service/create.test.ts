import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContainerEngine,
  EnvironmentCreationTypes,
  EnvironmentType,
  EnvironmentStatus,
} from '../types';

const endpointCreate = vi.fn();

vi.mock('@api/sdk.gen', () => ({
  endpointCreate: (...args: unknown[]) => endpointCreate(...args),
}));

import * as createModule from './create';

const { createLocalDockerEnvironment } = createModule;

function createdEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    Id: 11,
    Name: 'local',
    Type: EnvironmentType.Docker,
    Status: EnvironmentStatus.Up,
    ContainerEngine: ContainerEngine.Docker,
    Kubernetes: { Configuration: { StorageClasses: [], IngressClasses: [] } },
    ...overrides,
  };
}

describe('create local Docker environments (backwards compatibility)', () => {
  beforeEach(() => {
    endpointCreate.mockReset();
    endpointCreate.mockResolvedValue({ data: createdEndpoint() });
  });

  it('createLocalDockerEnvironment posts a local docker endpoint with empty socket by default', async () => {
    const env = await createLocalDockerEnvironment({ name: 'local' });
    expect(endpointCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        Name: 'local',
        EndpointCreationType: EnvironmentCreationTypes.LocalDockerEnvironment,
        URL: '',
        PublicURL: '',
      }),
    });
    expect(env.Id).toBe(11);
  });

  it('createLocalDockerEnvironment prefixes unix and npipe socket paths', async () => {
    await createLocalDockerEnvironment({
      name: 'unix-docker',
      socketPath: '/var/run/docker.sock',
      publicUrl: 'docker.example',
      containerEngine: ContainerEngine.Docker,
    });
    expect(endpointCreate.mock.calls[0][0].body.URL).toBe(
      'unix:///var/run/docker.sock'
    );
    expect(endpointCreate.mock.calls[0][0].body.PublicURL).toBe('docker.example');

    endpointCreate.mockClear();
    await createLocalDockerEnvironment({
      name: 'win-docker',
      socketPath: '//./pipe/docker_engine',
    });
    expect(endpointCreate.mock.calls[0][0].body.URL).toBe(
      'npipe:////./pipe/docker_engine'
    );
  });

  it('REQ-TAI-007 offers no Agent or remote Docker API creation helpers', () => {
    expect(createModule).not.toHaveProperty('createRemoteEnvironment');
    expect(createModule).not.toHaveProperty('createAgentEnvironment');
  });

  it('createEnvironment surfaces API errors', async () => {
    endpointCreate.mockRejectedValueOnce(new Error('create failed'));
    await expect(
      createLocalDockerEnvironment({ name: 'bad' })
    ).rejects.toBeTruthy();
  });

  it('REQ-TAI-008 offers no Azure creation helper and sends no Azure or TLS fields', async () => {
    expect(createModule).not.toHaveProperty('createAzureEnvironment');

    await createLocalDockerEnvironment({ name: 'local' });
    const body = endpointCreate.mock.calls[0][0].body;
    expect(body).not.toHaveProperty('AzureApplicationID');
    expect(body).not.toHaveProperty('TLS');
    expect(body).not.toHaveProperty('TLSCACertFile');
    // REQ-TAI-004: no Edge check-in interval is sent
    expect(body).not.toHaveProperty('EdgeCheckinInterval');
  });

  it('REQ-TAI-013 sends no GroupID or TagIds', async () => {
    await createLocalDockerEnvironment({ name: 'local' });
    const body = endpointCreate.mock.calls[0][0].body;
    expect(body).not.toHaveProperty('GroupID');
    expect(body).not.toHaveProperty('TagIds');
  });
});
