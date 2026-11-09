import { describe, expect, it } from 'vitest';

import WebEditorFormController from './web-editor-form.controller.js';

describe('WebEditorFormController', () => {
  it('stores the browser OS platform from DI', () => {
    const ctrl = new WebEditorFormController('mac');
    expect(ctrl.BROWSER_OS_PLATFORM).toBe('mac');
  });
});
