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

await import('./infoHelper.js');

function infoHelper() {
  return factoryState.factory();
}

describe('REQ-HOST-01 InfoHelper.determineEndpointMode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a non-swarm engine as DOCKER_STANDALONE', () => {
    const helper = infoHelper();
    expect(helper.determineEndpointMode({ Swarm: {} }, 1)).toEqual({
      provider: 'DOCKER_STANDALONE',
      role: '',
      agentProxy: false,
    });
  });

  it('marks empty Swarm.NodeID as DOCKER_STANDALONE', () => {
    const helper = infoHelper();
    expect(helper.determineEndpointMode({ Swarm: { NodeID: '' } }, 1)).toEqual({
      provider: 'DOCKER_STANDALONE',
      role: '',
      agentProxy: false,
    });
  });

  it('sets agentProxy for agent endpoint types 2 and 4', () => {
    const helper = infoHelper();
    expect(helper.determineEndpointMode({ Swarm: {} }, 2).agentProxy).toBe(true);
    expect(helper.determineEndpointMode({ Swarm: {} }, 4).agentProxy).toBe(true);
    expect(helper.determineEndpointMode({ Swarm: {} }, 1).agentProxy).toBe(false);
  });

  it('REQ-TAI-003 treats a Swarm manager or worker as a standalone engine', () => {
    const helper = infoHelper();
    expect(
      helper.determineEndpointMode({ Swarm: { NodeID: 'node-1', ControlAvailable: true } }, 1)
    ).toEqual({ provider: 'DOCKER_STANDALONE', role: '', agentProxy: false });
    expect(
      helper.determineEndpointMode({ Swarm: { NodeID: 'node-2', ControlAvailable: false } }, 1)
    ).toEqual({ provider: 'DOCKER_STANDALONE', role: '', agentProxy: false });
  });
});
