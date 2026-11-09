import { describe, expect, it, vi, beforeEach } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor =
        Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('moment', () => {
  const api = {
    subtract: vi.fn(() => api),
    format: vi.fn(() => '2020-01-01T00:00:00Z'),
  };
  return { default: () => api };
});

await import('./logViewerController.js');

describe('LogViewerController local container logs', () => {
  let $scope;
  let clipboard;
  let FileSaver;
  let BlobCtor;
  let jqueryApi;

  beforeEach(() => {
    $scope = { $evalAsync: (fn) => fn() };
    clipboard = {
      supported: true,
      copyText: vi.fn(),
    };
    FileSaver = { saveAs: vi.fn() };
    BlobCtor = vi.fn(function Blob(parts) {
      this.parts = parts;
    });
    jqueryApi = {
      show: vi.fn(),
      fadeOut: vi.fn(),
    };
    globalThis.$ = vi.fn(() => jqueryApi);
  });

  function createCtrl() {
    const ctrl = {
      logCollectionChange: vi.fn(),
      displayTimestamps: false,
      resourceName: 'web',
    };
    controllerState.ctor.call(ctrl, $scope, clipboard, BlobCtor, FileSaver);
    return ctrl;
  }

  it('initializes viewer state for local container logs', () => {
    const ctrl = createCtrl();
    expect(ctrl.state.copySupported).toBe(true);
    expect(ctrl.state.logCollection).toBe(true);
    expect(ctrl.state.autoScroll).toBe(true);
    expect(ctrl.state.wrapLines).toBe(true);
    expect(ctrl.state.availableSinceDatetime).toHaveLength(4);
  });

  it('toggles log collection wrap and timestamps', () => {
    const ctrl = createCtrl();
    ctrl.handleLogsCollectionChange(false);
    expect(ctrl.state.logCollection).toBe(false);
    expect(ctrl.state.autoScroll).toBe(false);
    expect(ctrl.logCollectionChange).toHaveBeenCalledWith(false);

    ctrl.handleLogsWrapLinesChange(false);
    expect(ctrl.state.wrapLines).toBe(false);

    ctrl.handleDisplayTimestampsChange(true);
    expect(ctrl.displayTimestamps).toBe(true);
  });

  it('copies filtered logs and selection to the clipboard', () => {
    const ctrl = createCtrl();
    ctrl.state.filteredLogs = [{ line: 'a' }, { line: 'b' }];
    ctrl.state.selectedLines = ['a'];

    ctrl.copy();
    expect(clipboard.copyText).toHaveBeenCalled();
    expect(jqueryApi.show).toHaveBeenCalled();
    expect(jqueryApi.fadeOut).toHaveBeenCalledWith(2000);

    ctrl.copySelection();
    expect(clipboard.copyText).toHaveBeenCalledTimes(2);
  });

  it('selects and clears log lines', () => {
    const ctrl = createCtrl();
    ctrl.selectLine('one');
    ctrl.selectLine('two');
    expect(ctrl.state.selectedLines).toEqual(['one', 'two']);
    ctrl.selectLine('one');
    expect(ctrl.state.selectedLines).toEqual(['two']);
    ctrl.clearSelection();
    expect(ctrl.state.selectedLines).toEqual([]);
  });

  it('downloads filtered logs as a text file', () => {
    const ctrl = createCtrl();
    ctrl.state.filteredLogs = [{ line: 'hello' }];
    ctrl.downloadLogs();
    expect(BlobCtor).toHaveBeenCalled();
    expect(FileSaver.saveAs).toHaveBeenCalledWith(
      expect.anything(),
      'web_logs.txt'
    );
  });
});
