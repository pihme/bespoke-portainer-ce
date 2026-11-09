import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const register = vi.fn();
  const component = vi.fn(function component() {
    return api;
  });
  const config = vi.fn(function config(fn: (p: { register: typeof register }) => void) {
    if (typeof fn === 'function') {
      fn({ register });
    }
    return api;
  });
  const api = { component, config };
  const angularMock = {
    module: vi.fn(() => api),
  };
  (globalThis as { angular?: typeof angularMock }).angular = angularMock;
  return { component, config, register, api, angularMock };
});

vi.mock('angular', () => ({
  default: hoisted.angularMock,
  module: hoisted.angularMock.module,
}));

vi.mock('@/react-tools/react2angular', () => ({
  r2a: (comp: unknown) => comp,
}));
vi.mock('@/react-tools/withCurrentUser', () => ({
  withCurrentUser: (c: unknown) => c,
}));
vi.mock('@/react-tools/withReactQuery', () => ({
  withReactQuery: (c: unknown) => c,
}));
vi.mock('@/react-tools/withUIRouter', () => ({
  withUIRouter: (c: unknown) => c,
}));

vi.mock('@/react/docker/containers/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/docker/containers/LogView', () => ({ LogView: () => null }));
vi.mock('@/react/docker/containers/CreateView', () => ({ CreateView: () => null }));
vi.mock('@/react/docker/containers/InspectView/InspectView', () => ({ InspectView: () => null }));
vi.mock('@/react/docker/containers/ItemView/ItemView', () => ({ ItemView: () => null }));
vi.mock('@/react/docker/containers/StatsView/StatsView', () => ({ StatsView: () => null }));
vi.mock('@/react/docker/images/ListView/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/docker/networks/ListView/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/docker/networks/ItemView', () => ({ ItemView: () => null }));
vi.mock('@/react/docker/DashboardView/DashboardView', () => ({ DashboardView: () => null }));
vi.mock('@/react/docker/events/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/docker/stacks/ItemView/ItemView', () => ({ ItemView: () => null }));
vi.mock('@/react/docker/stacks/CreateView/CreateView', () => ({ CreateView: () => null }));

describe('docker react views wrappers', () => {
  beforeEach(() => {
    hoisted.angularMock.module.mockClear();
    hoisted.component.mockClear();
    hoisted.config.mockClear();
    hoisted.register.mockClear();
  });

  it('registers images networks stacks containers and parent views', async () => {
    await import('./images');
    await import('./networks');
    await import('./stacks');
    await import('./containers');
    await import('./index');

    const names = hoisted.component.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        'imagesListView',
        'networksListView',
        'stackItemView',
        'createStackView',
        'createContainerView',
        'containersView',
        'containerItemView',
        'containerLogView',
        'dockerContainerInspectView',
        'containerStatsView',
        'dockerDashboardView',
        'eventsListView',
        'networkDetailsView',
      ])
    );
    expect(hoisted.register).toHaveBeenCalled();
  });

  it('REQ-TAI-003 registers no Docker Swarm configs view', async () => {
    await import('./index');

    const names = hoisted.component.mock.calls.map((c) => c[0]);
    expect(names).not.toContain('configsListView');
  });
});
