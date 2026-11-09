import { describe, it, expect, vi } from 'vitest';

/** Shared $q / $resource stubs for Angular factory unit tests in this directory. */

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

export function promiseResource(value) {
  return { $promise: Promise.resolve(value) };
}

export function rejectResource(err) {
  return { $promise: Promise.reject(err) };
}

describe('angularFactoryHelpers', () => {
  it('mockQ defer resolves and promiseResource wraps $promise', async () => {
    const $q = mockQ();
    const d = $q.defer();
    d.resolve('ok');
    await expect(d.promise).resolves.toBe('ok');
    await expect(promiseResource(1).$promise).resolves.toBe(1);
    await expect(rejectResource(new Error('x')).$promise).rejects.toThrow('x');
    await expect($q.all({ a: Promise.resolve(1), b: 2 })).resolves.toEqual({ a: 1, b: 2 });
  });
});
