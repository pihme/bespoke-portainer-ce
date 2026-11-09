import { describe, expect, it, vi } from 'vitest';

import CodeEditorController from './code-editor.controller.js';

describe('code-editor controller for local Compose/stack files', () => {
  it('sets yaml dockerfile or shell type on init', () => {
    const yamlCtrl = Object.create(CodeEditorController.prototype);
    yamlCtrl.yml = true;
    CodeEditorController.call(yamlCtrl, { $evalAsync: (fn) => fn() });
    yamlCtrl.$onInit();
    expect(yamlCtrl.type).toBe('yaml');

    const dockerCtrl = Object.create(CodeEditorController.prototype);
    dockerCtrl.dockerFile = true;
    CodeEditorController.call(dockerCtrl, { $evalAsync: (fn) => fn() });
    dockerCtrl.$onInit();
    expect(dockerCtrl.type).toBe('dockerfile');

    const shellCtrl = Object.create(CodeEditorController.prototype);
    shellCtrl.shell = true;
    CodeEditorController.call(shellCtrl, { $evalAsync: (fn) => fn() });
    shellCtrl.$onInit();
    expect(shellCtrl.type).toBe('shell');

    const plain = Object.create(CodeEditorController.prototype);
    CodeEditorController.call(plain, { $evalAsync: (fn) => fn() });
    plain.$onInit();
    expect(plain.type).toBeUndefined();
  });

  it('handleChange forwards values through $evalAsync', () => {
    const onChange = vi.fn();
    const $scope = { $evalAsync: (fn) => fn() };
    const ctrl = Object.create(CodeEditorController.prototype);
    CodeEditorController.call(ctrl, $scope);
    ctrl.onChange = onChange;
    ctrl.handleChange('services: {}');
    expect(onChange).toHaveBeenCalledWith('services: {}');
  });
});
