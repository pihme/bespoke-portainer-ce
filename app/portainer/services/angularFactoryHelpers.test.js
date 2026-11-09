import { describe, it, expect, vi } from 'vitest';

/** Shared $q stubs for Angular factory unit tests in this directory (COV-036). */

export function mockQ() {
  return {
    defer() {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return {
        promise,
        resolve,
        reject,
        notify: vi.fn(),
      };
    },
    all(input) {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      const keys = Object.keys(input);
      return Promise.all(keys.map((k) => Promise.resolve(input[k]))).then((values) => {
        const out = {};
        keys.forEach((k, i) => {
          out[k] = values[i];
        });
        return out;
      });
    },
  };
}

export function createAngularFactoryCapture() {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    service: vi.fn((_name, fn) => {
      factoryState.factory = Array.isArray(fn) ? fn[fn.length - 1] : fn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock, moduleApi };
}

describe('angularFactoryHelpers (parent services)', () => {
  it('mockQ defer resolves', async () => {
    const $q = mockQ();
    const d = $q.defer();
    d.resolve('ok');
    await expect(d.promise).resolves.toBe('ok');
  });
});
