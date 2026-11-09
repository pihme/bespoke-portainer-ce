import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RelativePathFieldset } from './RelativePathFieldset';
import { getDefaultRelativePathModel } from './types';

vi.mock('@@/PageHeader/ContextHelp', () => ({
  useDocsUrl: (path: string) => `https://docs.example${path}`,
}));

vi.mock('@/react/portainer/gitops/ComposePathField/PathSelector', () => ({
  PathSelector: vi.fn(
    ({
      value,
      onChange,
      placeholder,
      inputId,
    }: {
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      inputId?: string;
    }) => (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        id={inputId}
        data-testid="path-selector"
      />
    )
  ),
}));

describe('RelativePathFieldset', () => {
  it('renders the relative-path switch disabled when editing', () => {
    render(
      <RelativePathFieldset
        values={getDefaultRelativePathModel()}
        onChange={vi.fn()}
        isEditing
        hideEdgeConfigs
      />
    );

    const toggle = screen.getByTestId('gitops-enable-relative-paths-switch');
    expect(toggle.querySelector('input')).toBeDisabled();
    expect(
      screen.queryByTestId('relative-path-filesystem-path-input')
    ).not.toBeInTheDocument();
  });

  it('shows the local filesystem path when relative paths are enabled', () => {
    render(
      <RelativePathFieldset
        values={{
          ...getDefaultRelativePathModel(),
          SupportRelativePath: true,
          FilesystemPath: '/mnt',
        }}
        onChange={vi.fn()}
        hideEdgeConfigs
        errors={{ FilesystemPath: 'Local filesystem path is required' }}
      />
    );

    expect(
      screen.getByText(
        /For relative path volumes use with Docker Swarm, you must have a network filesystem/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('relative-path-filesystem-path-input')
    ).toHaveValue('/mnt');
    expect(
      screen.getByText('Local filesystem path is required')
    ).toBeInTheDocument();
  });

  it('enables relative paths through the switch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <RelativePathFieldset
        values={getDefaultRelativePathModel()}
        onChange={onChange}
        hideEdgeConfigs
      />
    );

    await user.click(screen.getByTestId('gitops-enable-relative-paths-switch'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ SupportRelativePath: true })
    );
  });

  it('updates the filesystem path when typing', () => {
    const onChange = vi.fn();

    render(
      <RelativePathFieldset
        values={{
          ...getDefaultRelativePathModel(),
          SupportRelativePath: true,
          FilesystemPath: '',
        }}
        onChange={onChange}
        hideEdgeConfigs
      />
    );

    fireEvent.change(screen.getByTestId('relative-path-filesystem-path-input'), {
      target: { value: '/data' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ FilesystemPath: '/data' })
    );
  });

  it('hides edge configuration controls when hideEdgeConfigs is set', () => {
    render(
      <RelativePathFieldset
        values={getDefaultRelativePathModel()}
        onChange={vi.fn()}
        hideEdgeConfigs
      />
    );

    expect(
      screen.queryByTestId('gitops-enable-per-device-configs-switch')
    ).not.toBeInTheDocument();
  });
});
