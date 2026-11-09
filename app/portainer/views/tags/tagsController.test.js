import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, fn) => {
      controllerState.ctor = fn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({ default: angularMock, module: angularMock.module }));
vi.mock('lodash-es', () => ({ default: { remove: (arr, item) => {
  const idx = arr.indexOf(item);
  if (idx >= 0) arr.splice(idx, 1);
} } }));

await import('./tagsController.js');

function deferred() {
  let resolve; let reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  p.resolve = resolve; p.reject = reject; return p;
}
function flush() { return Promise.resolve().then(() => Promise.resolve()); }

function buildController({ tags = [{ Id: 1, Name: 'prod' }], tagsError = null } = {}) {
  const $scope = { formValues: { Name: '' }, state: {} };
  const $state = { reload: vi.fn() };
  const $async = (fn, ...args) => fn(...args);
  const tagsPromise = deferred();
  const TagService = {
    tags: vi.fn(() => tagsPromise),
    createTag: vi.fn(() => Promise.resolve()),
    deleteTag: vi.fn(() => Promise.resolve()),
  };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  controllerState.ctor($scope, $state, $async, TagService, Notifications);
  async function settleInit() {
    if (tagsError) tagsPromise.reject(tagsError); else tagsPromise.resolve(tags);
    await tagsPromise.catch(() => undefined); await flush();
  }
  return { $scope, $state, TagService, Notifications, settleInit };
}

describe('REQ-ENV-14 TagsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads tags on init', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    expect(ctx.$scope.tags).toEqual([{ Id: 1, Name: 'prod' }]);
  });

  it('sets empty tags and notifies on load failure', async () => {
    const err = new Error('fail');
    const ctx = buildController({ tagsError: err });
    await ctx.settleInit();
    expect(ctx.$scope.tags).toEqual([]);
    expect(ctx.Notifications.error).toHaveBeenCalled();
  });

  it('validates duplicate names', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    const form = { name: { $setValidity: vi.fn() } };
    ctx.$scope.formValues.Name = 'prod';
    ctx.$scope.checkNameValidity(form);
    expect(form.name.$setValidity).toHaveBeenCalledWith('validName', false);
    ctx.$scope.formValues.Name = 'new';
    ctx.$scope.checkNameValidity(form);
    expect(form.name.$setValidity).toHaveBeenCalledWith('validName', true);
  });

  it('creates a tag and reloads', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    ctx.$scope.formValues.Name = 'staging';
    ctx.$scope.createTag();
    await flush();
    expect(ctx.TagService.createTag).toHaveBeenCalledWith('staging');
    expect(ctx.Notifications.success).toHaveBeenCalled();
    expect(ctx.$state.reload).toHaveBeenCalled();
  });

  it('notifies when create fails', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    ctx.TagService.createTag.mockRejectedValueOnce(new Error('nope'));
    ctx.$scope.formValues.Name = 'x';
    ctx.$scope.createTag();
    await flush();
    expect(ctx.Notifications.error).toHaveBeenCalled();
  });

  it('removes selected tags and reloads', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    const tag = ctx.$scope.tags[0];
    await ctx.$scope.removeAction([tag]);
    expect(ctx.TagService.deleteTag).toHaveBeenCalledWith(1);
    expect(ctx.$scope.tags).toEqual([]);
    expect(ctx.$state.reload).toHaveBeenCalled();
  });

  it('continues when a delete fails', async () => {
    const ctx = buildController({ tags: [{ Id: 1, Name: 'a' }, { Id: 2, Name: 'b' }] });
    await ctx.settleInit();
    ctx.TagService.deleteTag.mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(undefined);
    await ctx.$scope.removeAction([...ctx.$scope.tags]);
    expect(ctx.Notifications.error).toHaveBeenCalled();
    expect(ctx.$state.reload).toHaveBeenCalled();
  });
});
