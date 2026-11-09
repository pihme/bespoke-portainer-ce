import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { ContainerDetailsViewModel } from '@/docker/models/containerDetails';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockContainer } from '@/react-tools/test-mocks';

import { ContainerDetailsSection } from './ContainerDetailsSection';

function renderComponent(
  container: ContainerDetailsViewModel,
  nodeName?: string
) {
  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(ContainerDetailsSection))
  );

  return render(
    <Wrapped environmentId={1} container={container} nodeName={nodeName} />
  );
}

function bareContainer(
  overrides: Record<string, unknown> = {}
): ContainerDetailsViewModel {
  return {
    Id: 'container-id-123',
    Image: 'sha256:abcd1234',
    Config: {
      Image: 'nginx:latest',
      Cmd: ['nginx'],
      Entrypoint: ['/entrypoint.sh'],
      Env: ['PATH=/usr/bin'],
      Labels: { app: 'web' },
    },
    HostConfig: {
      RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
      Sysctls: { 'net.ipv4.ip_forward': '1' },
      SecurityOpt: ['no-new-privileges'],
      DeviceRequests: [],
    },
    NetworkSettings: {
      Ports: {
        '80/tcp': [{ HostIp: '127.0.0.1', HostPort: '8080' }],
      },
    },
    ...overrides,
  } as unknown as ContainerDetailsViewModel;
}

describe('REQ-CTR-04 ContainerDetailsSection', () => {
  test('renders container details correctly', () => {
    const container = createMockContainer({
      Image: 'hash',
      Config: { Image: 'nginx:latest' },
    });

    renderComponent(container);

    expect(screen.getByText('Container details')).toBeVisible();
    expect(screen.getByText('nginx:latest@hash')).toBeVisible();
    expect(screen.getByText('CMD')).toBeVisible();
  });

  test('returns null when config, hostConfig, or id is missing', () => {
    const { container: dom } = renderComponent({
      Id: '',
      Config: undefined,
      HostConfig: undefined,
    } as unknown as ContainerDetailsViewModel);

    expect(dom.querySelector('[data-cy="container-details-table"]')).toBeNull();
    expect(screen.queryByText('Container details')).not.toBeInTheDocument();
  });

  test('hides empty optional sections', () => {
    const container = bareContainer({
      Config: {
        Image: 'nginx:latest',
        Cmd: ['nginx'],
        Entrypoint: [],
        Env: [],
        Labels: {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
        Sysctls: {},
        DeviceRequests: [],
        SecurityOpt: [],
      },
      NetworkSettings: {
        Ports: {},
      },
    });

    renderComponent(container);

    expect(screen.queryByText('ENV')).not.toBeInTheDocument();
    expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    expect(screen.queryByText('Sysctls')).not.toBeInTheDocument();
    expect(screen.queryByText('SecurityOpt')).not.toBeInTheDocument();
    expect(screen.queryByText('GPUS')).not.toBeInTheDocument();
    expect(screen.queryByText('Port configuration')).not.toBeInTheDocument();
  });

  test('renders ENV, labels, ports, sysctls, security opts and entrypoint', () => {
    const container = bareContainer({
      Config: {
        Image: 'nginx:latest',
        Cmd: ['nginx'],
        Entrypoint: ['/docker-entrypoint.sh'],
        Env: ['ZEBRA=last', 'NOEQUALS', 'ALPHA=first'],
        Labels: { 'com.example.a': 'one', 'com.example.b': 'two' },
      },
      HostConfig: {
        RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 },
        Sysctls: { 'net.core.somaxconn': '1024' },
        SecurityOpt: ['label=disable', 'no-new-privileges'],
        DeviceRequests: [],
      },
      NetworkSettings: {
        Ports: {
          '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }],
          '443/tcp': undefined,
        },
      },
    });

    renderComponent(container, 'node-a');

    expect(screen.getByText('ENV')).toBeVisible();
    expect(screen.getByText('ALPHA')).toBeVisible();
    expect(screen.getByText('first')).toBeVisible();
    expect(screen.getByText('NOEQUALS')).toBeVisible();
    expect(screen.getByText('ZEBRA')).toBeVisible();

    expect(screen.getByText('Labels')).toBeVisible();
    expect(screen.getByText('com.example.a')).toBeVisible();
    expect(screen.getByText('one')).toBeVisible();

    expect(screen.getByText('Port configuration')).toBeVisible();
    expect(screen.getByText(/0\.0\.0\.0:8080/)).toBeVisible();
    expect(screen.getByText(/80\/tcp/)).toBeVisible();

    expect(screen.getByText('ENTRYPOINT')).toBeVisible();
    expect(screen.getByText('/docker-entrypoint.sh')).toBeVisible();

    expect(screen.getByText('Sysctls')).toBeVisible();
    expect(screen.getByText('net.core.somaxconn')).toBeVisible();
    expect(screen.getByText('1024')).toBeVisible();

    expect(screen.getByText('SecurityOpt')).toBeVisible();
    expect(screen.getByText('label=disable')).toBeVisible();
    expect(screen.getByText('no-new-privileges')).toBeVisible();
  });

  test('renders GPU row when device requests include nvidia GPUs', () => {
    const container = bareContainer({
      Config: {
        Image: 'nginx:latest',
        Cmd: ['nginx'],
        Entrypoint: [],
        Env: [],
        Labels: {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
        Sysctls: {},
        SecurityOpt: [],
        DeviceRequests: [
          {
            Driver: 'nvidia',
            Count: -1,
            DeviceIDs: [],
            Capabilities: [['gpu']],
            Options: {},
          },
        ],
      },
      NetworkSettings: { Ports: {} },
    });

    renderComponent(container);

    expect(screen.getByText('GPUS')).toBeVisible();
    expect(screen.getByText('all,"capabilities=gpu"')).toBeVisible();
  });


  test('hides port configuration when NetworkSettings.Ports is undefined', () => {
    const container = bareContainer({
      Config: {
        Image: 'nginx:latest',
        Cmd: ['nginx'],
        Entrypoint: [],
        Env: [],
        Labels: {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
        Sysctls: {},
        SecurityOpt: [],
        DeviceRequests: [],
      },
      NetworkSettings: {
        Ports: undefined,
      },
    });

    renderComponent(container);

    expect(screen.queryByText('Port configuration')).not.toBeInTheDocument();
  });

  test('renders ENTRYPOINT as null when entrypoint is missing', () => {
    const container = bareContainer({
      Config: {
        Image: 'nginx:latest',
        Cmd: ['nginx'],
        Entrypoint: undefined,
        Env: [],
        Labels: {},
      },
      HostConfig: {
        RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
        Sysctls: {},
        SecurityOpt: [],
        DeviceRequests: [],
      },
      NetworkSettings: { Ports: {} },
    });

    renderComponent(container);

    expect(screen.getByText('ENTRYPOINT')).toBeVisible();
    expect(screen.getByText('null')).toBeVisible();
  });
});
