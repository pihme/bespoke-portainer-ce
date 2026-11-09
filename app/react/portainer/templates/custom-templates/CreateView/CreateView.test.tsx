import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { ContainerEngine } from '@/react/portainer/environments/types';

const mockUseViewType = vi.fn();
const mockUseEnvironmentId = vi.fn();

vi.mock('../useViewType', () => ({
  useViewType: () => mockUseViewType(),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: (...args: unknown[]) => mockUseEnvironmentId(...args),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({
    title,
    breadcrumbs,
  }: {
    title: string;
    breadcrumbs: Array<string | { label: string }>;
  }) => (
    <div>
      <h1>{title}</h1>
      <nav>
        {breadcrumbs.map((crumb) =>
          typeof crumb === 'string' ? crumb : crumb.label
        )}
      </nav>
    </div>
  ),
}));

vi.mock('@@/Widget', () => {
  function Widget({ children }: { children: React.ReactNode }) {
    return <div data-cy="widget">{children}</div>;
  }
  Widget.Body = function Body({ children }: { children: React.ReactNode }) {
    return <div data-cy="widget-body">{children}</div>;
  };
  return { Widget };
});

vi.mock('./CreateForm', () => ({
  CreateForm: ({
    viewType,
    environmentId,
    defaultType,
  }: {
    viewType: string;
    environmentId?: number;
    defaultType: StackType;
  }) => (
    <div
      data-cy="create-form"
      data-view-type={viewType}
      data-environment-id={String(environmentId ?? '')}
      data-default-type={String(defaultType)}
    />
  ),
}));

import { CreateView } from './CreateView';

describe('REQ-TPL-03 CreateView', () => {
  beforeEach(() => {
    mockUseViewType.mockReset();
    mockUseEnvironmentId.mockReset();
    mockUseEnvironmentId.mockReturnValue(3);
  });

  it('renders the create page chrome and compose default for docker', () => {
    mockUseViewType.mockReturnValue(ContainerEngine.Docker);

    render(<CreateView />);

    expect(
      screen.getByRole('heading', { name: 'Create Custom Template' })
    ).toBeVisible();
    expect(screen.getByText(/Custom Templates/)).toBeInTheDocument();

    const form = screen.getByTestId('create-form');
    expect(form).toHaveAttribute('data-view-type', 'docker');
    expect(form).toHaveAttribute('data-environment-id', '3');
    expect(form).toHaveAttribute(
      'data-default-type',
      String(StackType.DockerCompose)
    );
    expect(mockUseEnvironmentId).toHaveBeenCalledWith(false);
  });

  it('REQ-TAI-003 never defaults to a Docker Swarm template', () => {
    mockUseViewType.mockReturnValue('docker');

    render(<CreateView />);

    expect(screen.getByTestId('create-form')).toHaveAttribute(
      'data-default-type',
      String(StackType.DockerCompose)
    );
  });

  it('falls back to compose for unknown view types', () => {
    mockUseViewType.mockReturnValue('edge');
    mockUseEnvironmentId.mockReturnValue(undefined);

    render(<CreateView />);

    const form = screen.getByTestId('create-form');
    expect(form).toHaveAttribute(
      'data-default-type',
      String(StackType.DockerCompose)
    );
    expect(form).toHaveAttribute('data-environment-id', '');
  });
});
