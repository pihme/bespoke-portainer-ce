import { describe, it, expect, vi, beforeEach } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./containerHelper.js');

function containerHelper() {
  return factoryState.factory();
}

function baseContainer(overrides = {}) {
  return {
    Name: '/my-app',
    Config: {
      Image: 'nginx:latest',
      Env: ['FOO=bar'],
      ExposedPorts: { '80/tcp': {} },
      Labels: { app: 'web' },
    },
    HostConfig: {
      NetworkMode: 'bridge',
      Binds: [],
      Mounts: null,
    },
    NetworkSettings: {
      Networks: {
        bridge: { NetworkID: 'net-1', IPAddress: '172.18.0.2' },
      },
    },
    Mounts: [
      { Name: 'data', Destination: '/data', RW: true, Source: '/var/lib/docker/volumes/data/_data' },
      { Name: 'ro-cfg', Destination: '/cfg', RW: false, Source: '/var/lib/docker/volumes/ro-cfg/_data' },
      { Source: '/host/path', Destination: '/host', RW: true },
    ],
    ...overrides,
  };
}

describe('REQ-CTR-06 ContainerHelper.configFromContainer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds a recreate/duplicate config with name, networks and binds', () => {
    const helper = containerHelper();
    const config = helper.configFromContainer(baseContainer());

    expect(config.name).toBe('my-app');
    expect(config.HostConfig.NetworkMode).toBe('bridge');
    expect(config.NetworkingConfig.EndpointsConfig.bridge.IPAddress).toBe('172.18.0.2');
    expect(config.HostConfig.Mounts).toBeNull();
    expect(config.HostConfig.Binds).toEqual([
      'data:/data',
      'ro-cfg:/cfg:ro',
      '/host/path:/host',
    ]);
    expect(config.Volumes).toEqual({
      '/data': {},
      '/cfg': {},
      '/host': {},
    });
    expect(config.ExposedPorts).toEqual({ '80/tcp': {} });
  });

  it('initialises ExposedPorts when missing on a bridge container', () => {
    const helper = containerHelper();
    const container = baseContainer({
      Config: { Image: 'busybox', Labels: {} },
    });
    const config = helper.configFromContainer(container);
    expect(config.ExposedPorts).toEqual({});
  });

  it('drops Hostname and ExposedPorts when NetworkMode is container:<id>', () => {
    const helper = containerHelper();
    const container = baseContainer({
      Config: {
        Image: 'busybox',
        Hostname: 'should-go',
        ExposedPorts: { '80/tcp': {} },
      },
      HostConfig: { NetworkMode: 'container:abc123', Binds: [], Mounts: null },
      Mounts: [],
    });
    const config = helper.configFromContainer(container);
    expect(config.Hostname).toBeUndefined();
    expect(config.ExposedPorts).toBeUndefined();
  });

  it('skips mounts that lack a destination', () => {
    const helper = containerHelper();
    const container = baseContainer({
      Mounts: [{ Name: 'orphan', Destination: '', RW: true }],
    });
    const config = helper.configFromContainer(container);
    expect(config.HostConfig.Binds).toEqual([]);
    expect(config.Volumes).toEqual({});
  });
});

describe('REQ-CTR-03 ContainerHelper.preparePortBindings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps a single host/container port pair', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([{ hostPort: '8080', containerPort: '80', protocol: 'tcp' }])
    ).toEqual({
      '80/tcp': [{ HostIp: undefined, HostPort: '8080' }],
    });
  });

  it('skips bindings without a container port', () => {
    const helper = containerHelper();
    expect(helper.preparePortBindings([{ hostPort: '8080', protocol: 'tcp' }])).toEqual({});
  });

  it('expands matching host and container port ranges', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([
        { hostPort: '8000-8001', containerPort: '80-81', protocol: 'tcp' },
      ])
    ).toEqual({
      '80/tcp': [{ HostIp: undefined, HostPort: '8000' }],
      '81/tcp': [{ HostIp: undefined, HostPort: '8001' }],
    });
  });

  it('parses an IPv4 host IP prefix on the host port', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([
        { hostPort: '127.0.0.1:8080', containerPort: '80', protocol: 'tcp' },
      ])
    ).toEqual({
      '80/tcp': [{ HostIp: '127.0.0.1', HostPort: '8080' }],
    });
  });

  it('parses a bracketed IPv6 host IP prefix on the host port', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([
        { hostPort: '[::1]:8080', containerPort: '80', protocol: 'tcp' },
      ])
    ).toEqual({
      '80/tcp': [{ HostIp: '::1', HostPort: '8080' }],
    });
  });

  it('allows a host port range on a single container port', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([
        { hostPort: '8080-8081', containerPort: '80', protocol: 'tcp' },
      ])
    ).toEqual({
      '80/tcp': [{ HostIp: undefined, HostPort: '8080-8081' }],
    });
  });

  it('appends a second binding when the same container port/protocol is repeated', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([
        { hostPort: '8080', containerPort: '80', protocol: 'tcp' },
        { hostPort: '8081', containerPort: '80', protocol: 'tcp' },
      ])
    ).toEqual({
      '80/tcp': [
        { HostIp: undefined, HostPort: '8080' },
        { HostIp: undefined, HostPort: '8081' },
      ],
    });
  });

  it('throws on an invalid container port', () => {
    const helper = containerHelper();
    expect(() =>
      helper.preparePortBindings([{ hostPort: '8080', containerPort: '0', protocol: 'tcp' }])
    ).toThrow(/Invalid port specification: 0/);
  });

  it('throws on an invalid host port', () => {
    const helper = containerHelper();
    expect(() =>
      helper.preparePortBindings([{ hostPort: '0', containerPort: '80', protocol: 'tcp' }])
    ).toThrow(/Invalid port specification: 0/);
  });

  it('throws when host and container ranges have different lengths', () => {
    const helper = containerHelper();
    expect(() =>
      helper.preparePortBindings([
        { hostPort: '8000-8002', containerPort: '80-81', protocol: 'tcp' },
      ])
    ).toThrow(/Invalid port specification: 8000-8002/);
  });

  it('throws on a malformed bracketed IPv6 host port', () => {
    const helper = containerHelper();
    expect(() =>
      helper.preparePortBindings([{ hostPort: '[::1', containerPort: '80', protocol: 'tcp' }])
    ).toThrow(/Invalid port specification: 80/);
  });

  it('maps a binding with no host port (ephemeral publish)', () => {
    const helper = containerHelper();
    expect(
      helper.preparePortBindings([{ containerPort: '80', protocol: 'tcp' }])
    ).toEqual({
      '80/tcp': [{ HostIp: undefined, HostPort: undefined }],
    });
  });
});

describe('REQ-CTR-03 ContainerHelper.sortAndCombinePorts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combines consecutive host/container ports into ranges', () => {
    const helper = containerHelper();
    const bindings = helper.sortAndCombinePorts({
      '80/tcp': [{ HostIp: '', HostPort: '8080' }],
      '81/tcp': [{ HostIp: '', HostPort: '8081' }],
      '82/tcp': [{ HostIp: '', HostPort: '8082' }],
    });
    expect(bindings).toEqual([
      { hostPort: '8080-8082', containerPort: '80-82', protocol: 'tcp' },
    ]);
  });

  it('keeps a host IP on the combined host port range', () => {
    const helper = containerHelper();
    const bindings = helper.sortAndCombinePorts({
      '80/tcp': [{ HostIp: '127.0.0.1', HostPort: '8080' }],
      '81/tcp': [{ HostIp: '127.0.0.1', HostPort: '8081' }],
    });
    expect(bindings).toEqual([
      { hostPort: '127.0.0.1:8080-8081', containerPort: '80-81', protocol: 'tcp' },
    ]);
  });

  it('does not combine when host ports are missing (ephemeral)', () => {
    const helper = containerHelper();
    const bindings = helper.sortAndCombinePorts({
      '80/tcp': [{ HostIp: '', HostPort: '0' }],
      '81/tcp': [{ HostIp: '', HostPort: '0' }],
    });
    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toMatchObject({ containerPort: 80, protocol: 'tcp' });
    expect(bindings[1]).toMatchObject({ containerPort: 81, protocol: 'tcp' });
  });

  it('groups by protocol independently', () => {
    const helper = containerHelper();
    const bindings = helper.sortAndCombinePorts({
      '53/udp': [{ HostIp: '', HostPort: '53' }],
      '53/tcp': [{ HostIp: '', HostPort: '53' }],
    });
    expect(bindings).toEqual(
      expect.arrayContaining([
        { hostPort: '53', containerPort: 53, protocol: 'udp' },
        { hostPort: '53', containerPort: 53, protocol: 'tcp' },
      ])
    );
  });
});

describe('REQ-CTR-01 ContainerHelper.getContainerNames', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flattens and strips leading slashes from container Names', () => {
    const helper = containerHelper();
    expect(
      helper.getContainerNames([
        { Names: ['/web', '/web-alias'] },
        { Names: ['/db'] },
      ])
    ).toEqual(['web', 'web-alias', 'db']);
  });

  it('returns an empty list for no containers', () => {
    const helper = containerHelper();
    expect(helper.getContainerNames([])).toEqual([]);
  });
});
