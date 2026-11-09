import { render, screen } from '@testing-library/react';

import { createMockUser } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { Source } from '../types';

import { ListView } from './ListView';

const sources: Source[] = [
  {
    id: 1,
    name: 'compose-a',
    type: 'git',
    url: 'https://example.com/a.git',
    status: 'healthy',
    usedBy: 1,
    environments: 1,
    lastSync: 1_700_000_000,
  },
  {
    id: 2,
    name: 'compose-b',
    type: 'git',
    url: 'https://example.com/b.git',
    status: 'error',
    error: 'boom',
    usedBy: 0,
    environments: 0,
    lastSync: 0,
  },
  {
    id: 3,
    name: 'charts',
    type: 'helm',
    url: 'oci://example.com/charts',
    status: 'syncing',
    usedBy: 2,
    environments: 2,
    lastSync: 1_700_000_100,
  },
];

let listState = {
  search: '',
  sortBy: { id: 'name', desc: false } as { id: string; desc: boolean } | null,
  page: 0,
  pageSize: 10,
  status: null as string | null,
  type: null as string | null,
  setStatus: vi.fn(),
  setType: vi.fn(),
  setSearch: vi.fn(),
  setSortBy: vi.fn(),
  setPage: vi.fn(),
  setPageSize: vi.fn(),
};

let sourcesQuery = {
  data: { data: sources, totalCount: sources.length } as
    | { data: Source[]; totalCount: number }
    | undefined,
  isLoading: false,
};

let summaryQuery = {
  data: {
    healthy: 1,
    error: 1,
    syncing: 1,
    paused: 0,
    unknown: 0,
  } as Record<string, number> | undefined,
  isLoading: false,
};

vi.mock('./useListState', () => ({
  useListState: () => listState,
}));

vi.mock('../queries/useSources', () => ({
  useSources: () => sourcesQuery,
}));

vi.mock('../queries/useSourcesSummary', () => ({
  useSourcesSummary: () => summaryQuery,
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

vi.mock('@@/buttons', async () => {
  const actual = await vi.importActual<typeof import('@@/buttons')>('@@/buttons');
  return {
    ...actual,
    AddButton: ({ children }: { children: React.ReactNode }) => (
      <button type="button" data-cy="add-source-button">
        {children}
      </button>
    ),
  };
});

function renderView() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ListView), createMockUser())
  );
  return render(<Wrapped />);
}

describe('REQ-GIT-02 ListView', () => {
  beforeEach(() => {
    listState = {
      search: '',
      sortBy: { id: 'name', desc: false },
      page: 0,
      pageSize: 10,
      status: null,
      type: null,
      setStatus: vi.fn(),
      setType: vi.fn(),
      setSearch: vi.fn(),
      setSortBy: vi.fn(),
      setPage: vi.fn(),
      setPageSize: vi.fn(),
    };
    sourcesQuery = {
      data: { data: sources, totalCount: sources.length },
      isLoading: false,
    };
    summaryQuery = {
      data: {
        healthy: 1,
        error: 1,
        syncing: 1,
        paused: 0,
        unknown: 0,
      },
      isLoading: false,
    };
  });

  it('lists gitops sources for local stacks', () => {
    renderView();

    expect(screen.getAllByText('GitOps Sources').length).toBeGreaterThan(0);
    expect(screen.getByTestId('add-source-button')).toBeVisible();
    expect(screen.getByText('compose-a')).toBeVisible();
    expect(screen.getByText('compose-b')).toBeVisible();
    expect(screen.getByText('charts')).toBeVisible();
  });

  it('groups sources by status when sorted by status', () => {
    listState.sortBy = { id: 'status', desc: false };
    renderView();

    expect(screen.getByText('compose-b')).toBeVisible();
    expect(screen.getByText('compose-a')).toBeVisible();
    expect(screen.getByText('charts')).toBeVisible();
    expect(screen.getByText('boom')).toBeVisible();
  });

  it('groups sources by type when sorted by type', () => {
    listState.sortBy = { id: 'type', desc: false };
    renderView();

    expect(screen.getByText('compose-a')).toBeVisible();
    expect(screen.getByText('charts')).toBeVisible();
    expect(screen.getAllByText('Git').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Helm').length).toBeGreaterThan(0);
  });

  it('shows the empty message when there are no sources', () => {
    sourcesQuery = {
      data: { data: [], totalCount: 0 },
      isLoading: false,
    };
    renderView();

    expect(screen.getByText('No sources found')).toBeVisible();
  });

  it('handles a missing summary payload', () => {
    summaryQuery = { data: undefined, isLoading: false };
    renderView();

    expect(screen.getByText('compose-a')).toBeVisible();
  });
});
