import { describe, expect, it } from 'vitest';

import { webEditorForm } from './index.js';

describe('webEditorForm component config', () => {
  it('exposes template, controller and editor bindings', () => {
    expect(webEditorForm.templateUrl).toContain('web-editor-form.html');
    expect(webEditorForm.controller).toBeTruthy();
    expect(webEditorForm.bindings).toMatchObject({
      identifier: '@',
      textTip: '@',
      yml: '<',
      value: '<',
      onChange: '<',
    });
    expect(webEditorForm.transclude).toEqual({
      description: '?editorDescription',
    });
  });
});
