import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getDefaultModel } from './types';

vi.mock('@/react/portainer/gitops/sources/GitSourceSelector', () => ({
  GitSourceSelector: ({
    onChange,
    error,
  }: {
    onChange: (source?: { id: number }) => void;
    error?: string;
  }) => (
    <div>
      <button
        type="button"
        data-cy="mock-source"
        onClick={() => onChange({ id: 42 })}
      >
        pick source
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

vi.mock('@/react/portainer/gitops/RefField', () => ({
  RefField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="ref"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/react/portainer/gitops/ComposePathField', () => ({
  ComposePathField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="compose-path"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('./AutoUpdateFieldset', () => ({
  AutoUpdateFieldset: () => <div data-cy="auto-update">auto-update</div>,
}));

vi.mock('./TimeWindowDisplay', () => ({
  TimeWindowDisplay: () => <div data-cy="time-window">time-window</div>,
}));

vi.mock('./AdditionalFilesField', () => ({
  AdditionalFileField: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (v: string[]) => void;
  }) => (
    <button type="button" onClick={() => onChange([...value, 'x.yml'])}>
      add-additional
    </button>
  ),
}));

import {
  buildGitValidationSchema,
  GitForm,
  validateGitForm,
} from './GitForm';

describe('REQ GitForm local compose helpers', () => {
  it('renders the git repository section and forwards field changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const model = {
      ...getDefaultModel(),
      SourceId: 1,
      AdditionalFiles: [],
    };

    render(
      <GitForm
        value={model}
        onChange={onChange}
        isAdditionalFilesFieldVisible
        isAutoUpdateVisible
        errors={{ SourceId: 'Source is required' }}
      />
    );

    expect(screen.getByText('Git repository')).toBeInTheDocument();
    expect(screen.getByText('Source is required')).toBeInTheDocument();
    expect(screen.getByText('auto-update')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /pick source/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ SourceId: 42 })
    );

    await user.clear(screen.getByLabelText('ref'));
    await user.type(screen.getByLabelText('ref'), 'refs/heads/dev');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ RepositoryReferenceName: expect.any(String) })
    );

    await user.click(screen.getByRole('button', { name: /add-additional/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ AdditionalFiles: ['x.yml'] })
    );
  });

  it('hides additional files and auto-update when flags say so', () => {
    render(
      <GitForm
        value={{ ...getDefaultModel(), AutoUpdate: undefined }}
        onChange={() => {}}
        isAdditionalFilesFieldVisible={false}
        isAutoUpdateVisible={false}
      />
    );
    expect(screen.queryByText('auto-update')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add-additional/i })
    ).not.toBeInTheDocument();
  });

  it('buildGitValidationSchema and validateGitForm enforce compose path and source', async () => {
    const schema = buildGitValidationSchema('compose');
    await expect(
      schema.validate({
        SourceId: 1,
        ComposeFilePathInRepository: 'docker-compose.yml',
        RepositoryReferenceName: '',
        AdditionalFiles: [],
      })
    ).resolves.toBeTruthy();

    await expect(
      schema.validate({
        SourceId: 0,
        ComposeFilePathInRepository: '',
        RepositoryReferenceName: '',
        AdditionalFiles: [''],
      })
    ).rejects.toBeTruthy();

    const manifestSchema = buildGitValidationSchema('manifest');
    try {
      await manifestSchema.validate({
        SourceId: 1,
        ComposeFilePathInRepository: '',
        RepositoryReferenceName: '',
        AdditionalFiles: [],
      });
    } catch (e) {
      expect(String(e)).toMatch(/Manifest file path is required/i);
    }

    const errors = await validateGitForm({
      ...getDefaultModel(),
      SourceId: 0,
      ComposeFilePathInRepository: '',
    });
    expect(errors).toBeTruthy();
  });
});
