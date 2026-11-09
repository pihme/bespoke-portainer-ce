import { describe, expect, it, vi } from 'vitest';

vi.mock('./git-form.controller', () => ({
  default: class GitFormController {},
}));

import { gitForm } from './git-form';

describe('gitForm component options', () => {
  it('exposes the react-git-form template and bindings', () => {
    expect(gitForm.template).toContain('react-git-form');
    expect(gitForm.bindings).toMatchObject({
      value: '<',
      onChange: '<',
      environmentType: '@',
      isDockerStandalone: '<',
    });
    expect(gitForm.controller).toBeTypeOf('function');
  });
});
