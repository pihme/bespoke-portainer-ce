import { describe, expect, it } from 'vitest';

import { initialBuildMethods } from './types';

describe('REQ-TPL-03 CreateView types', () => {
  it('exposes editor, upload and repository build methods for local create', () => {
    expect(initialBuildMethods.map((method) => method.value)).toEqual([
      'editor',
      'upload',
      'repository',
    ]);
    expect(initialBuildMethods.map((method) => method.label)).toEqual([
      'Web editor',
      'Upload',
      'Repository',
    ]);
  });
});
