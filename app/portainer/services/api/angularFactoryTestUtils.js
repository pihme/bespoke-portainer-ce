import { vi } from 'vitest';

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

/** Capture factory/service fn and expose global angular for bare `angular.module` files. */
export function createAngularModuleMock(factoryState) {
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
  const angular = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angular;
  return { default: angular, module: angular.module };
}
