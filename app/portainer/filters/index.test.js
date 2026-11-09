import { describe, expect, it, vi } from 'vitest';

const { filterFns, moduleApi, angularMock } = vi.hoisted(() => {
  const filterFns = {};
  const moduleApi = {
    filter: vi.fn((name, factory) => {
      filterFns[name] = factory;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { filterFns, moduleApi, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/docker/components/datatable/createOwnershipColumn', () => ({
  ownershipIcon: () => 'fa-user',
}));

vi.mock('@/react/common/string-utils', () => ({
  stripProtocol: (v) => v,
}));

await import('./index.js');

describe('portainer.app filter registration', () => {
  it('registers local Docker UI filters on the portainer.app module', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    const names = [
      'truncate',
      'truncatelr',
      'capitalize',
      'stripprotocol',
      'humansize',
      'getisodatefromtimestamp',
      'getisodate',
      'key',
      'value',
      'emptyobject',
      'ipaddress',
      'arraytostr',
      'labelsToStr',
      'endpointtypename',
      'ownershipicon',
    ];
    expect(Object.keys(filterFns).sort()).toEqual(names.sort());
    for (const name of names) {
      const factory = filterFns[name];
      const impl = typeof factory === 'function' ? factory() : factory;
      expect(impl).toBeTypeOf('function');
    }
  });
});
