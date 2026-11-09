import { render, screen } from '@testing-library/react';
import { CellContext } from '@tanstack/react-table';
import { vi } from 'vitest';
import type { FC } from 'react';

import { TableSettingsProvider } from '@@/datatables/useTableSettings';
import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { createStore } from '../datatable-store';
import { QuickAction } from '../types';

import { quickActions as quickActionsColumn } from './quick-actions';

let authorized = true;

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useAuthorizations: () => ({ authorized }),
    Authorized: ({ children }: { children: React.ReactNode }) =>
      authorized ? children : null,
  };
});

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

function renderQuickActions({
  hidden = [] as QuickAction[],
}: {
  hidden?: QuickAction[];
} = {}) {
  const key = `qa-${Date.now()}-${Math.random()}`;
  const store = createStore(key);
  store.getState().setHiddenQuickActions(hidden);

  const Cell = quickActionsColumn.cell as FC<
    CellContext<ContainerListViewModel, unknown>
  >;
  const ctx = {
    row: {
      original: {
        Id: 'cid-qa',
        Names: ['app'],
        Status: ContainerStatus.Running,
        NodeName: 'n1',
      } as ContainerListViewModel,
    },
  } as unknown as CellContext<ContainerListViewModel, unknown>;

  return render(
    <TableSettingsProvider settings={store}>
      <Cell {...ctx} />
    </TableSettingsProvider>
  );
}

describe('REQ-CTR-01 containers datatable quick actions column', () => {
  beforeEach(() => {
    authorized = true;
  });

  it('exports a quick actions display column', () => {
    expect(quickActionsColumn.id).toBe('actions');
    expect(quickActionsColumn.header).toBe('Quick Actions');
  });

  it('renders quick action links when authorized and visible', () => {
    renderQuickActions();

    expect(screen.getByTestId('container-logs-cid-qa')).toBeInTheDocument();
    expect(screen.getByTestId('container-inspect-cid-qa')).toBeInTheDocument();
    expect(screen.getByTestId('container-stats-cid-qa')).toBeInTheDocument();
    expect(screen.getByTestId('container-exec-cid-qa')).toBeInTheDocument();
    expect(screen.getByTestId('container-attach-cid-qa')).toBeInTheDocument();
  });

  it('returns null when the user is not authorized', () => {
    authorized = false;
    renderQuickActions();
    expect(
      screen.queryByTestId('container-logs-cid-qa')
    ).not.toBeInTheDocument();
  });

  it('returns null when every quick action is hidden', () => {
    renderQuickActions({
      hidden: ['attach', 'exec', 'inspect', 'logs', 'stats'],
    });
    expect(
      screen.queryByTestId('container-logs-cid-qa')
    ).not.toBeInTheDocument();
  });

  it('hides individual actions from settings while keeping others', () => {
    renderQuickActions({ hidden: ['attach', 'exec'] });

    expect(screen.getByTestId('container-logs-cid-qa')).toBeInTheDocument();
    expect(
      screen.queryByTestId('container-attach-cid-qa')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('container-exec-cid-qa')
    ).not.toBeInTheDocument();
  });
});
