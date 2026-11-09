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

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./mainController.js');

describe('MainController', () => {
  it('registers on the portainer.app module at load time', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    expect(controllerState.ctor).toEqual(expect.any(Function));
  });

  it('exposes application state, sidebar open helper, and applies auto theme', () => {
    const $scope = {};
    const state = { loading: false };
    const StateManager = { getState: vi.fn(() => state) };
    const ThemeManager = { autoTheme: vi.fn() };
    const isSidebarOpen = vi.fn(() => true);
    const SidebarService = { isSidebarOpen };

    controllerState.ctor($scope, StateManager, ThemeManager, SidebarService);

    expect($scope.applicationState).toBe(state);
    expect($scope.isSidebarOpen).toBe(isSidebarOpen);
    expect(ThemeManager.autoTheme).toHaveBeenCalled();
    expect(StateManager.getState).toHaveBeenCalled();
  });
});
