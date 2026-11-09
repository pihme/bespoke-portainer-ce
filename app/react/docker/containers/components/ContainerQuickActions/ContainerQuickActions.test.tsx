import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReactNode } from 'react';

import { ContainerStatus } from '@/react/docker/containers/types';

import {
  ContainerQuickActions,
  QuickActionsState,
} from './ContainerQuickActions';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    title,
    'data-cy': dataCy,
  }: {
    children: ReactNode;
    title?: string;
    'data-cy'?: string;
  }) => (
    <a data-cy={dataCy} title={title} href="/">
      {children}
    </a>
  ),
}));

vi.mock('@/react/hooks/useUser', () => ({
  Authorized: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const allOn: QuickActionsState = {
  showQuickActionAttach: true,
  showQuickActionExec: true,
  showQuickActionInspect: true,
  showQuickActionLogs: true,
  showQuickActionStats: true,
};

function renderActions(
  status: ContainerStatus,
  state: QuickActionsState = allOn
) {
  return render(
    <ContainerQuickActions
      containerId="c1"
      nodeName="node"
      status={status}
      state={state}
    />
  );
}

describe('ContainerQuickActions', () => {
  it('shows logs and inspect always when enabled, and active-only actions when running', () => {
    renderActions(ContainerStatus.Running);
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
    expect(screen.getByTitle('Inspect')).toBeInTheDocument();
    expect(screen.getByTitle('Stats')).toBeInTheDocument();
    expect(screen.getByTitle('Exec Console')).toBeInTheDocument();
    expect(screen.getByTitle('Attach Console')).toBeInTheDocument();
  });

  it('hides active-only actions when the container is stopped', () => {
    renderActions(ContainerStatus.Stopped);
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
    expect(screen.queryByTitle('Stats')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Exec Console')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Attach Console')).not.toBeInTheDocument();
  });

  it('respects per-action visibility flags', () => {
    renderActions(ContainerStatus.Healthy, {
      showQuickActionAttach: false,
      showQuickActionExec: false,
      showQuickActionInspect: false,
      showQuickActionLogs: true,
      showQuickActionStats: false,
    });
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
    expect(screen.queryByTitle('Inspect')).not.toBeInTheDocument();
  });
});
