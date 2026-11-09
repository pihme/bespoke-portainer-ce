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

await import('./codeEditorController.js');

describe('legacy CodeEditorController', () => {
  beforeEach(() => {
    expect(controllerState.ctor).toBeTypeOf('function');
  });

  it('initializes CodeMirror on the identifier element and wires onChange', () => {
    const editor = {
      on: vi.fn(),
      setValue: vi.fn(),
      getValue: vi.fn(() => ''),
      setOption: vi.fn(),
    };
    const CodeMirrorService = {
      applyCodeMirrorOnElement: vi.fn(() => editor),
    };
    const element = {};
    const $document = [
      {
        getElementById: vi.fn(() => element),
      },
    ];
    $document.ready = (fn) => fn();
    const $scope = { $evalAsync: (fn) => fn() };

    const ctrl = { identifier: 'editor-1', yml: true, readOnly: false, value: 'x: 1', onChange: vi.fn() };
    controllerState.ctor.call(ctrl, $document, CodeMirrorService, $scope);
    ctrl.$onInit();

    expect(CodeMirrorService.applyCodeMirrorOnElement).toHaveBeenCalledWith(
      element,
      true,
      false
    );
    expect(editor.setValue).toHaveBeenCalledWith('x: 1');
    expect(editor.on).toHaveBeenCalledWith('change', expect.any(Function));

    const changeHandler = editor.on.mock.calls[0][1];
    changeHandler('doc', 'change');
    expect(ctrl.onChange).toHaveBeenCalled();
  });

  it('$onChanges updates editor value and readOnly when present', () => {
    const editor = {
      getValue: vi.fn((opt) => (opt === 'readOnly' ? false : 'old')),
      setValue: vi.fn(),
      setOption: vi.fn(),
    };
    const ctrl = {
      editor,
      readOnly: true,
      value: 'new',
    };
    controllerState.ctor.call(ctrl, {}, {}, { $evalAsync: (fn) => fn() });

    ctrl.$onChanges({
      value: { currentValue: 'new' },
      readOnly: { currentValue: true },
    });
    expect(editor.setOption).toHaveBeenCalledWith('readOnly', true);
    expect(editor.setValue).toHaveBeenCalledWith('new');

    ctrl.editor = undefined;
    expect(() => ctrl.$onChanges({ value: { currentValue: 'x' } })).not.toThrow();
  });
});
