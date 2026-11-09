import { describe, expect, it } from 'vitest';

import { fileUploadForm } from './index';

describe('fileUploadForm', () => {
  it('exports bindings and optional description slot for local uploads', () => {
    expect(fileUploadForm.templateUrl).toBe('./file-upload-form.html');
    expect(fileUploadForm.bindings).toEqual({
      file: '<',
      ngRequired: '<',
      onChange: '<',
    });
    expect(fileUploadForm.transclude).toEqual({
      description: '?fileUploadDescription',
    });
  });
});
