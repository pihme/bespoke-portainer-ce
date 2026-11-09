import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { ContainerEngine } from '@/react/portainer/environments/types';

const mockUseViewType = vi.fn();
const mockUseEnvironmentId = vi.fn();
const mockUseIsSwarmManager = vi.fn();

vi.mock('../useViewType', () => ({
  useViewType: () => mockUseViewType(),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: (...args: unknown[]) => mockUseEnvironmentId(...args),
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarmManager: (...args: unknown[]) => mockUseIsSwarmManager(...args),
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
    mockUseIsSwarmManager.mockReset();
    mockUseEnvironmentId.mockReturnValue(3);
  });

  it('renders the create page chrome and compose default for docker workers', () => {
    mockUseViewType.mockReturnValue(ContainerEngine.Docker);
    mockUseIsSwarmManager.mockReturnValue(false);

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
    expect(mockUseIsSwarmManager).toHaveBeenCalledWith(3, {
      enabled: true,
    });
    expect(mockUseEnvironmentId).toHaveBeenCalledWith(false);
  });

  it('defaults to swarm type when the docker environment is a swarm manager', () => {
    mockUseViewType.mockReturnValue('docker');
    mockUseIsSwarmManager.mockReturnValue(true);

    render(<CreateView />);

    expect(screen.getByTestId('create-form')).toHaveAttribute(
      'data-default-type',
      String(StackType.DockerSwarm)
    );
  });

  it('defaults to kubernetes type for kube view', () => {
    mockUseViewType.mockReturnValue('kube');
    mockUseIsSwarmManager.mockReturnValue(false);

    render(<CreateView />);

    expect(screen.getByTestId('create-form')).toHaveAttribute(
      'data-default-type',
      String(StackType.Kubernetes)
    );
    expect(mockUseIsSwarmManager).toHaveBeenCalledWith(3, {
      enabled: false,
    });
  });

  it('falls back to compose for unknown view types', () => {
    mockUseViewType.mockReturnValue('edge');
    mockUseIsSwarmManager.mockReturnValue(false);
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
