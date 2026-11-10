import { describe, expect, it } from 'vitest';

import { customTemplate, editor, git, upload, url } from './build-methods';
import * as buildMethods from './build-methods';

describe('BoxSelector build-methods options', () => {
  it('exposes editor upload git url and template options', () => {
    expect(editor.value).toBe('editor');
    expect(upload.value).toBe('upload');
    expect(git.value).toBe('repository');
    expect(url.value).toBe('url');
    expect(customTemplate.value).toBe('template');
  });

  it('REQ-TAI-018 offers no Helm chart method', () => {
    const mod: Record<string, unknown> = buildMethods;
    expect(mod).not.toHaveProperty('helm');
    expect(mod).not.toHaveProperty('edgeStackTemplate');
  });
});
