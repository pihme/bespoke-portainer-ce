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

await import('./labelHelper.js');

function labelHelper() {
  return factoryState.factory();
}

describe('REQ-CTR-03 LabelHelper label conversions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fromLabelHashToKeyValue maps a label hash to editable rows', () => {
    const helper = labelHelper();
    expect(helper.fromLabelHashToKeyValue({ app: 'web', env: 'prod' })).toEqual([
      { key: 'app', value: 'web', originalKey: 'app', originalValue: 'web', added: true },
      { key: 'env', value: 'prod', originalKey: 'env', originalValue: 'prod', added: true },
    ]);
  });

  it('fromLabelHashToKeyValue returns [] for missing labels', () => {
    const helper = labelHelper();
    expect(helper.fromLabelHashToKeyValue(null)).toEqual([]);
    expect(helper.fromLabelHashToKeyValue(undefined)).toEqual([]);
  });

  it('fromKeyValueToLabelHash rebuilds a hash and skips empty keys', () => {
    const helper = labelHelper();
    expect(
      helper.fromKeyValueToLabelHash([
        { key: 'app', value: 'web' },
        { key: '', value: 'ignored' },
        { key: 'env', value: 'prod' },
      ])
    ).toEqual({ app: 'web', env: 'prod' });
  });

  it('fromKeyValueToLabelHash returns {} for missing input', () => {
    const helper = labelHelper();
    expect(helper.fromKeyValueToLabelHash(null)).toEqual({});
  });
});
