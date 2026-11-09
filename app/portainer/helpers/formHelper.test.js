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

await import('./formHelper.js');

function formHelper() {
  return factoryState.factory();
}

describe('FormHelper removeInvalidEnvVars', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes env entries that have no name and keeps named ones', () => {
    const helper = formHelper();
    const env = [
      { name: 'FOO', value: '1' },
      { name: '', value: 'drop-me' },
      { name: null, value: 'also-drop' },
      { name: 'BAR', value: '2' },
    ];

    const cleaned = helper.removeInvalidEnvVars(env);

    expect(cleaned).toEqual([
      { name: 'FOO', value: '1' },
      { name: 'BAR', value: '2' },
    ]);
    expect(cleaned).toBe(env);
  });

  it('returns an empty list when every entry lacks a name', () => {
    const helper = formHelper();
    expect(helper.removeInvalidEnvVars([{ name: '' }, { name: undefined }])).toEqual([]);
  });

  it('leaves a fully named list unchanged', () => {
    const helper = formHelper();
    const env = [{ name: 'A', value: 'a' }];
    expect(helper.removeInvalidEnvVars(env)).toEqual([{ name: 'A', value: 'a' }]);
  });
});
