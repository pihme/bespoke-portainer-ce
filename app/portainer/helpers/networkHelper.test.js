import { describe, it, expect, vi } from 'vitest';

const { angularMock } = vi.hoisted(() => {
  const moduleApi = {
    service: vi.fn((_name, ctor) => moduleApi),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { angularMock, moduleApi };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

const { default: NetworkHelper } = await import('./networkHelper.js');

describe('REQ-NET-02 NetworkHelper system networks', () => {
  const predefined = ['host', 'bridge', 'ingress', 'nat', 'none'];

  it('isSystemNetwork is true for each predefined network name', () => {
    const helper = new NetworkHelper(predefined);
    for (const name of predefined) {
      expect(helper.isSystemNetwork({ Name: name })).toBe(true);
    }
  });

  it('isSystemNetwork is false for a user-defined network', () => {
    const helper = new NetworkHelper(predefined);
    expect(helper.isSystemNetwork({ Name: 'app-net' })).toBe(false);
  });
});
