import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ajaxSend } = vi.hoisted(() => ({
  ajaxSend: vi.fn(),
}));

vi.mock('jquery', () => {
  function $(arg) {
    if (arg === document || (arg && arg.nodeType === 9)) {
      return { ajaxSend: (fn) => ajaxSend(fn) };
    }
    return {};
  }
  $.ajaxSend = ajaxSend;
  return { default: $ };
});

import { onStartupAngular } from './app';

describe('onStartupAngular', () => {
  beforeEach(() => {
    ajaxSend.mockClear();
  });

  it('guards the loading bar against going backwards', () => {
    const $rootScope = {};
    const $state = {};
    const originalSet = vi.fn();
    const cfpLoadingBar = {
      set: originalSet,
      status: vi.fn(() => 0.5),
    };
    const $transitions = {
      onBefore: vi.fn(),
      onStart: vi.fn(),
    };
    const HttpRequestHelper = { resetAgentHeaders: vi.fn() };

    onStartupAngular(
      $rootScope,
      $state,
      cfpLoadingBar,
      $transitions,
      HttpRequestHelper
    );

    expect($rootScope.$state).toBe($state);

    cfpLoadingBar.set(0.2);
    expect(originalSet).not.toHaveBeenCalled();
    cfpLoadingBar.set(0.8);
    expect(originalSet).toHaveBeenCalled();

    expect($transitions.onBefore).toHaveBeenCalled();
    const beforeHook = $transitions.onBefore.mock.calls[0][1];
    beforeHook();
    expect(HttpRequestHelper.resetAgentHeaders).toHaveBeenCalled();

    expect($transitions.onStart).toHaveBeenCalled();
    const startHook = $transitions.onStart.mock.calls[0][1];
    const transition = {
      treeChanges: () => ({ to: [{ state: { name: 'a' } }] }),
      router: {
        viewService: {
          _viewConfigs: [
            { viewDecl: { $context: { name: 'a' } } },
            { viewDecl: { $context: { name: 'b' } } },
          ],
        },
      },
    };
    startHook(transition);
    expect(transition.router.viewService._viewConfigs).toHaveLength(1);

    expect(ajaxSend).toHaveBeenCalled();
    const ajaxHandler = ajaxSend.mock.calls[0][0];
    const setRequestHeader = vi.fn();
    ajaxHandler(
      {},
      { setRequestHeader },
      { type: 'POST', contentType: false, headers: {} }
    );
    expect(setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );

    setRequestHeader.mockClear();
    ajaxHandler(
      {},
      { setRequestHeader },
      { type: 'GET', contentType: false, headers: {} }
    );
    expect(setRequestHeader).not.toHaveBeenCalled();
  });
});
