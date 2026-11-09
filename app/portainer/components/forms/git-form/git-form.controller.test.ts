import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/react/portainer/gitops/GitForm', () => ({
  validateGitForm: vi.fn(),
}));

import { validateGitForm } from '@/react/portainer/gitops/GitForm';
import { getDefaultModel } from '@/react/portainer/gitops/types';

import GitFormController from './git-form.controller';

describe('GitFormController', () => {
  const $async = vi.fn(async <T,>(fn: () => Promise<T>) => fn());

  beforeEach(() => {
    vi.mocked(validateGitForm).mockReset();
    vi.mocked(validateGitForm).mockResolvedValue({});
  });

  it('validates on init and merges changes through onChange', async () => {
    const onChange = vi.fn();
    const controller = new GitFormController($async);
    controller.value = getDefaultModel();
    controller.onChange = onChange;
    controller.gitForm = {
      $setValidity: vi.fn(),
    } as never;

    await controller.$onInit();
    expect(validateGitForm).toHaveBeenCalledWith(
      controller.value,
      undefined
    );
    expect(controller.gitForm?.$setValidity).toHaveBeenCalledWith(
      'gitForm',
      true,
      controller.gitForm
    );

    await controller.handleChange({ RepositoryURL: 'https://example.com/repo.git' });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        RepositoryURL: 'https://example.com/repo.git',
      })
    );
  });

  it('marks the form invalid when validation returns errors', async () => {
    vi.mocked(validateGitForm).mockResolvedValue({
      RepositoryURL: 'required',
    });
    const controller = new GitFormController($async);
    controller.value = getDefaultModel();
    controller.gitForm = { $setValidity: vi.fn() } as never;

    await controller.runGitFormValidation(controller.value);
    expect(controller.errors).toEqual({ RepositoryURL: 'required' });
    expect(controller.gitForm?.$setValidity).toHaveBeenCalledWith(
      'gitForm',
      false,
      controller.gitForm
    );
  });

  it('throws when value is missing on change or init', async () => {
    const controller = new GitFormController($async);
    await expect(controller.handleChange({})).rejects.toThrow(
      /value is required/
    );
    await expect(controller.$onInit()).rejects.toThrow(/value is required/);
  });
});
