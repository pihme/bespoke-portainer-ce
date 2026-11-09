import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CreateView } from './CreateView';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 42,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarmManager: vi.fn(() => false),
}));

vi.mock('@/react/docker/proxy/queries/useSwarm', () => ({
  useSwarmId: vi.fn(() => ({ isLoading: false, data: undefined })),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@@/Widget', () => {
  function Widget({ children }: { children: React.ReactNode }) {
    return <div data-cy="widget">{children}</div>;
  }
  Widget.Body = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Widget };
});

vi.mock('./CreateStackForm/CreateStackForm', () => ({
  CreateStackForm: ({
    environmentId,
    isSwarm,
    swarmId,
  }: {
    environmentId: number;
    isSwarm: boolean;
    swarmId: string;
  }) => (
    <div data-cy="create-stack-form">
      env:{environmentId};swarm:{String(isSwarm)};id:{swarmId || 'none'}
    </div>
  ),
}));

import { useIsSwarmManager } from '@/react/docker/proxy/queries/useInfo';
import { useSwarmId } from '@/react/docker/proxy/queries/useSwarm';

describe('CreateView parent chrome', () => {
  it('renders compose create form for non-swarm managers', () => {
    vi.mocked(useIsSwarmManager).mockReturnValue(false);
    render(<CreateView />);
    expect(screen.getByText('Create stack')).toBeVisible();
    expect(screen.getByTestId('create-stack-form')).toHaveTextContent(
      'env:42;swarm:false;id:none'
    );
  });

  it('returns null while swarm id is loading', () => {
    vi.mocked(useIsSwarmManager).mockReturnValue(true);
    vi.mocked(useSwarmId).mockReturnValue({
      isLoading: true,
      data: undefined,
    } as ReturnType<typeof useSwarmId>);
    const { container } = render(<CreateView />);
    expect(container).toBeEmptyDOMElement();
  });

  it('passes swarm id once loaded', () => {
    vi.mocked(useIsSwarmManager).mockReturnValue(true);
    vi.mocked(useSwarmId).mockReturnValue({
      isLoading: false,
      data: 'swarm-abc',
    } as ReturnType<typeof useSwarmId>);
    render(<CreateView />);
    expect(screen.getByTestId('create-stack-form')).toHaveTextContent(
      'env:42;swarm:true;id:swarm-abc'
    );
  });
});
