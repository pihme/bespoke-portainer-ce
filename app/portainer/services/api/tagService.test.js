import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource, rejectResource } from './angularFactoryHelpers.test.js';


const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
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
  const angularMock = { module: vi.fn(() => moduleApi) };
  // Production factories use bare global `angular` (no import).
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./tagService.js');

describe('REQ-ENV-14 TagService', () => {
  beforeEach(() => vi.clearAllMocks());

  function build(Tags) {
    const $async = (fn, ...args) => Promise.resolve(fn(...args));
    return factoryState.factory(mockQ(), $async, Tags);
  }

  it('tags maps API tags into TagViewModel', async () => {
    const Tags = {
      query: vi.fn(() => promiseResource([{ Id: 1, Name: 'prod' }])),
      create: vi.fn(() => promiseResource({ Id: 2, Name: 'dev' })),
      remove: vi.fn(() => promiseResource({})),
    };
    const service = build(Tags);
    const tags = await service.tags();
    expect(tags[0].Name).toBe('prod');
    const names = await service.tagNames();
    expect(names).toEqual(['prod']);
  });

  it('createTag and deleteTag call Tags resource', async () => {
    const Tags = {
      query: vi.fn(),
      create: vi.fn(() => promiseResource({ Id: 2, Name: 'dev' })),
      remove: vi.fn(() => promiseResource({})),
    };
    const service = build(Tags);
    const tag = await service.createTag('dev');
    expect(tag.Name).toBe('dev');
    await service.deleteTag(2);
    expect(Tags.remove).toHaveBeenCalledWith({ id: 2 });
  });

  it('tags rejects with a clear message on failure', async () => {
    const service = build({ query: vi.fn(() => rejectResource(new Error('x'))) });
    await expect(service.tags()).rejects.toMatchObject({ msg: 'Unable to retrieve tags' });
  });
});
