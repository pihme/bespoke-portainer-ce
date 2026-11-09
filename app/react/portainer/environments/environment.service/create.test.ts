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

import {
  createAgentEnvironment,
  createLocalDockerEnvironment,
  createRemoteEnvironment,
} from './create';

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
        TagIds: '[]',
      }),
    });
    expect(env.Id).toBe(11);
  });

  it('createLocalDockerEnvironment prefixes unix and npipe socket paths', async () => {
    await createLocalDockerEnvironment({
      name: 'unix-docker',
      socketPath: '/var/run/docker.sock',
      publicUrl: 'docker.example',
      meta: { groupId: 2, tagIds: [3] },
      containerEngine: ContainerEngine.Docker,
    });
    expect(endpointCreate.mock.calls[0][0].body.URL).toBe(
      'unix:///var/run/docker.sock'
    );
    expect(endpointCreate.mock.calls[0][0].body.PublicURL).toBe('docker.example');
    expect(endpointCreate.mock.calls[0][0].body.GroupID).toBe(2);

    endpointCreate.mockClear();
    await createLocalDockerEnvironment({
      name: 'win-docker',
      socketPath: '//./pipe/docker_engine',
    });
    expect(endpointCreate.mock.calls[0][0].body.URL).toBe(
      'npipe:////./pipe/docker_engine'
    );
  });

  it('createRemoteEnvironment prefixes tcp and createAgentEnvironment skips TLS verify', async () => {
    await createRemoteEnvironment({
      name: 'remote',
      url: '10.0.0.1:2375',
      creationType: EnvironmentCreationTypes.LocalDockerEnvironment,
      options: { meta: { tagIds: [1] } },
    });
    expect(endpointCreate.mock.calls[0][0].body.URL).toBe('tcp://10.0.0.1:2375');

    endpointCreate.mockClear();
    await createAgentEnvironment({
      name: 'agent',
      environmentUrl: '10.0.0.2:9001',
      meta: { tagIds: [] },
    });
    const body = endpointCreate.mock.calls[0][0].body;
    expect(body.EndpointCreationType).toBe(
      EnvironmentCreationTypes.AgentEnvironment
    );
    expect(body.URL).toBe('tcp://10.0.0.2:9001');
    expect(body.TLS).toBe(true);
    expect(body.TLSSkipVerify).toBe(true);
    expect(body.TLSSkipClientVerify).toBe(true);
    expect(body.ContainerEngine).toBe(ContainerEngine.Docker);
  });

  it('createEnvironment rejects kube-config creation and surfaces API errors', async () => {
    await expect(
      createRemoteEnvironment({
        name: 'kube',
        url: 'x',
        creationType: EnvironmentCreationTypes.KubeConfigEnvironment as never,
      })
    ).rejects.toThrow(/Kube config creation is not supported on CE/);

    endpointCreate.mockRejectedValueOnce(new Error('create failed'));
    await expect(
      createLocalDockerEnvironment({ name: 'bad' })
    ).rejects.toBeTruthy();
  });

  it('includes TLS file and azure fields when provided through remote options', async () => {
    const ca = new File(['ca'], 'ca.pem');
    const cert = new File(['cert'], 'cert.pem');
    const key = new File(['key'], 'key.pem');
    await createRemoteEnvironment({
      name: 'tls-docker',
      url: 'host:2376',
      creationType: EnvironmentCreationTypes.AgentEnvironment,
      options: {
        tls: {
          skipVerify: false,
          skipClientVerify: false,
          caCertFile: ca,
          certFile: cert,
          keyFile: key,
        },
        azure: {
          applicationId: 'app',
          tenantId: 'tenant',
          authenticationKey: 'key',
        },
      },
    });
    const body = endpointCreate.mock.calls[0][0].body;
    expect(body.TLSCACertFile).toBe(ca);
    expect(body.TLSCertFile).toBe(cert);
    expect(body.TLSKeyFile).toBe(key);
    expect(body.AzureApplicationID).toBe('app');
    // REQ-TAI-004: no Edge check-in interval is sent
    expect(body).not.toHaveProperty('EdgeCheckinInterval');
  });
});
