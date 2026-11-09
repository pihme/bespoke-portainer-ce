import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource, rejectResource } from './angularFactoryHelpers.test.js';


const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    service: vi.fn((_name, fn) => {
      factoryState.factory = fn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  // Production factories use bare global `angular` (no import).
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/portainer/gitops/AutoUpdateFieldset/utils', () => ({
  transformAutoUpdateViewModel: vi.fn((v) => v),
}));

await import('./stackService.js');

function buildService(overrides = {}) {
  const $q = mockQ();
  const $async = (fn, ...args) => Promise.resolve(fn(...args));
  const Stack = {
    get: vi.fn(({ id }) =>
      promiseResource({
        Id: id,
        Name: 'compose-a',
        Type: 2,
        EndpointId: 1,
        Status: 1,
        Env: [],
      })
    ),
    getStackFile: vi.fn(() => promiseResource({ StackFileContent: 'services:\n  web:\n    image: nginx\n' })),
    query: vi.fn(() => promiseResource([])),
    remove: vi.fn(() => promiseResource({})),
    associate: vi.fn(() => promiseResource({ Id: 1 })),
    update: vi.fn(() => promiseResource({ Id: 1 })),
    create: vi.fn(() => promiseResource({ Id: 11 })),
    start: vi.fn(() => promiseResource({})),
    stop: vi.fn(() => promiseResource({})),
    updateGit: vi.fn(() => promiseResource({})),
    updateGitStackSettings: vi.fn(() => promiseResource({})),
    ...overrides.Stack,
  };
  const StackByName = { remove: vi.fn(() => promiseResource({})), ...(overrides.StackByName || {}) };
  const FileUploadService = {
    createComposeStack: vi.fn(() => Promise.resolve({ data: { Id: 12 } })),
    ...(overrides.FileUploadService || {}),
  };
  const StackHelper = {
    getExternalStacksFromServices: vi.fn(() => []),
    getExternalStacksFromContainers: vi.fn(() => [{ Name: 'ext' }]),
    ...(overrides.StackHelper || {}),
  };
  const ServiceService = { services: vi.fn(() => Promise.resolve([])), ...(overrides.ServiceService || {}) };
  const ContainerService = {
    containers: vi.fn(() => Promise.resolve([])),
    ...(overrides.ContainerService || {}),
  };
  const SwarmService = { swarm: vi.fn(() => Promise.resolve({ ID: 'swarm' })), ...(overrides.SwarmService || {}) };

  const service = factoryState.factory(
    $q,
    $async,
    Stack,
    StackByName,
    FileUploadService,
    StackHelper,
    ServiceService,
    ContainerService,
    SwarmService
  );
  return { service, Stack, StackHelper, ContainerService, SwarmService, FileUploadService };
}

describe('REQ-STK-01 StackService local compose client', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stack returns a StackViewModel for the compose stack', async () => {
    const { service, Stack } = buildService();
    const stack = await service.stack(5);
    expect(Stack.get).toHaveBeenCalledWith({ id: 5 });
    expect(stack.Id).toBe(5);
    expect(stack.Name).toBe('compose-a');
  });

  it('stack rejects with a clear message on failure', async () => {
    const { service } = buildService({
      Stack: { get: vi.fn(() => rejectResource(new Error('missing'))) },
    });
    await expect(service.stack(1)).rejects.toMatchObject({
      msg: 'Unable to retrieve stack details',
    });
  });

  it('getStackFile returns compose file content', async () => {
    const { service } = buildService();
    await expect(service.getStackFile(1)).resolves.toContain('nginx');
  });

  it('unionStacks marks orphaned running stacks and dedupes by name', () => {
    const { service } = buildService();
    const stacks = [{ Name: 'a', Orphaned: true }, { Name: 'b', Orphaned: false }];
    const external = [{ Name: 'a' }, { Name: 'c' }];
    const result = service.unionStacks(stacks, external);
    expect(stacks[0].OrphanedRunning).toBe(true);
    expect(result.map((s) => s.Name).sort()).toEqual(['a', 'b', 'c']);
  });

  it('composeStacks without external stacks returns mapped stacks', async () => {
    const { service, Stack } = buildService({
      Stack: {
        query: vi.fn(() =>
          promiseResource([
            { Id: 1, Name: 'web', Type: 2, EndpointId: 1, Status: 1, Env: [] },
          ])
        ),
      },
    });
    const stacks = await service.composeStacks(1, false, { EndpointID: 1 });
    expect(Stack.query).toHaveBeenCalled();
    expect(stacks).toHaveLength(1);
    expect(stacks[0].Name).toBe('web');
  });

  it('remove deletes a compose stack by id', async () => {
    const { service, Stack } = buildService();
    await service.remove({ Id: 3, Name: 'web' }, false, 1);
    expect(Stack.remove).toHaveBeenCalledWith({ id: 3, external: false, endpointId: 1 });
  });

  it('associate for compose stack (Type != 1) skips swarm lookup', async () => {
    const { service, Stack, SwarmService } = buildService();
    await service.associate({ Id: 2, Type: 2 }, 1, false);
    expect(SwarmService.swarm).not.toHaveBeenCalled();
    expect(Stack.associate).toHaveBeenCalledWith({ id: 2, endpointId: 1, orphanedRunning: false });
  });
});

describe('REQ-STK-02 StackService compose create and lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createComposeStackFromFileContent posts standalone string stacks', async () => {
    const { service, Stack } = buildService();
    await service.createComposeStackFromFileContent('web', 'services: {}', [], 1);
    expect(Stack.create).toHaveBeenCalledWith(
      { endpointId: 1 },
      expect.objectContaining({ method: 'string', type: 'standalone', Name: 'web' })
    );
  });

  it('createComposeStackFromFileUpload uses FileUploadService', async () => {
    const { service, FileUploadService } = buildService();
    await service.createComposeStackFromFileUpload('web', new Blob(['x']), [], 1);
    expect(FileUploadService.createComposeStack).toHaveBeenCalledWith('web', expect.anything(), [], 1);
  });

  it('createComposeStackFromGitRepository posts repository standalone stacks', async () => {
    const { service, Stack } = buildService();
    await service.createComposeStackFromGitRepository(
      'web',
      {
        RepositoryURL: 'https://example.com/r.git',
        RepositoryReferenceName: 'refs/heads/main',
        ComposeFilePathInRepository: 'docker-compose.yml',
        AutoUpdate: { Interval: '5m' },
      },
      [],
      1
    );
    expect(Stack.create).toHaveBeenCalledWith(
      { endpointId: 1 },
      expect.objectContaining({
        method: 'repository',
        type: 'standalone',
        RepositoryURL: 'https://example.com/r.git',
        AutoUpdate: { Interval: '5m' },
      })
    );
  });

  it('updateStack, start and stop call Stack resource', async () => {
    const { service, Stack } = buildService();
    await service.updateStack({ Id: 3, EndpointId: 1 }, 'file', [], true, false);
    await service.start(1, 3);
    await service.stop(1, 3);
    expect(Stack.update).toHaveBeenCalled();
    expect(Stack.start).toHaveBeenCalledWith({ id: 3, endpointId: 1 });
    expect(Stack.stop).toHaveBeenCalledWith({ endpointId: 1, id: 3 });
  });

  it('updateGit and updateGitStackSettings update compose git stacks', async () => {
    const { service, Stack } = buildService();
    await service.updateGit(3, 1, [], false, {
      RefName: 'main',
      RepositoryAuthentication: false,
    }, true);
    await service.updateGitStackSettings(
      3,
      1,
      [],
      {
        AutoUpdate: { Interval: '5m' },
        RefName: 'main',
        RepositoryAuthentication: false,
        Option: { Prune: true },
        TLSSkipVerify: false,
      },
      'hook'
    );
    expect(Stack.updateGit).toHaveBeenCalled();
    expect(Stack.updateGitStackSettings).toHaveBeenCalled();
  });

  it('composeStacks can include external compose stacks from containers', async () => {
    const { service, ContainerService, StackHelper } = buildService({
      Stack: {
        query: vi.fn(() => promiseResource([{ Id: 1, Name: 'web', Type: 2, EndpointId: 1, Status: 1, Env: [] }])),
      },
    });
    const stacks = await service.composeStacks(1, true, { EndpointID: 1 });
    expect(ContainerService.containers).toHaveBeenCalledWith(1, 1);
    expect(StackHelper.getExternalStacksFromContainers).toHaveBeenCalled();
    expect(stacks.map((s) => s.Name).sort()).toEqual(['ext', 'web']);
  });

  it('stacks with compose only merges compose and external container stacks', async () => {
    const { service } = buildService({
      Stack: {
        query: vi.fn(() => promiseResource([{ Id: 1, Name: 'web', Type: 2, EndpointId: 1, Status: 1, Env: [] }])),
      },
    });
    // stacks() always asks composeStacks to include external compose stacks
    const stacks = await service.stacks(true, false, 1, false);
    expect(stacks.map((s) => s.Name).sort()).toEqual(['ext', 'web']);
  });
});
