import { describe, expect, it, vi } from 'vitest';

import { AngularToReact } from './angularToReact';

describe('AngularToReact bridge (backwards compatibility)', () => {
  it('useAxios wraps the axios function with $async', async () => {
    const $async = vi.fn(async (fn: (...a: unknown[]) => Promise<unknown>, ...args: unknown[]) => fn(...args));
    const EndpointProvider = { endpointID: () => 9 };
    const bridge = AngularToReact(EndpointProvider as any, $async as any);
    const axiosFunc = vi.fn(async (envId: unknown, name: unknown) => `${envId}:${name}`);
    const wrapped = bridge.useAxios(axiosFunc as any);
    await expect(wrapped(1, 'svc')).resolves.toBe('1:svc');
    expect($async).toHaveBeenCalled();
  });

  it('injectEnvironmentId prepends EndpointProvider.endpointID()', async () => {
    const $async = vi.fn();
    const EndpointProvider = { endpointID: () => 42 };
    const bridge = AngularToReact(EndpointProvider as any, $async as any);
    const axiosFunc = vi.fn(async (envId: unknown, id: unknown) => ({ envId, id }));
    const injected = bridge.injectEnvironmentId(axiosFunc as any);
    await expect(injected('abc')).resolves.toEqual({ envId: 42, id: 'abc' });
    expect(axiosFunc).toHaveBeenCalledWith(42, 'abc');
  });
});
