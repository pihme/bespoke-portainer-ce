import { describe, expect, it } from 'vitest';

import {
  customTemplate,
  edgeStackTemplate,
  editor,
  git,
  helm,
  upload,
  url,
} from './build-methods';

describe('BoxSelector build-methods options', () => {
  it('exposes editor upload git url helm and template options', () => {
    expect(editor.value).toBe('editor');
    expect(upload.value).toBe('upload');
    expect(git.value).toBe('repository');
    expect(url.value).toBe('url');
    expect(helm.value).toBe('helm');
    expect(edgeStackTemplate.value).toBe('template');
    expect(customTemplate.value).toBe('template');
  });
});
