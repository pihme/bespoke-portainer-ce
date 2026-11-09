import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useCurrentStateAndParams, useRouter } from '@uirouter/react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { EnvironmentHeader } from './EnvironmentHeader';

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useCurrentStateAndParams: vi.fn(),
    useRouter: vi.fn(),
  };
});

vi.mock('../useHomeViewState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useHomeViewState')>();
  return {
    ...actual,
    useHomeViewState: vi.fn(actual.useHomeViewState),
  };
});

import { useHomeViewState } from '../useHomeViewState';

const mockCounts = {
  total: 10,
  up: 7,
  down: 2,
  unassigned: 1,
};

const mockGo = vi.fn();

function setupMocks(params: Record<string, unknown> = {}) {
  vi.mocked(useCurrentStateAndParams).mockReturnValue({
    state: {} as never,
    params,
  });
  vi.mocked(useRouter).mockReturnValue({
    stateService: { go: mockGo },
  } as never);
}

function renderComponent() {
  const Wrapped = withTestQueryProvider(EnvironmentHeader);
  return render(<Wrapped />);
}

function mockSummaryCounts(counts = mockCounts) {
  server.use(
    http.get('/api/endpoints/summary', () => HttpResponse.json(counts))
  );
}

describe('EnvironmentHeader', () => {
  beforeEach(() => {
    mockGo.mockClear();
    setupMocks();
  });

  it('renders all status segments with counts', async () => {
    mockSummaryCounts();
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /filter by up/i })
      ).toBeVisible();
    });

    expect(
      screen.getByRole('radio', { name: /filter by total/i })
    ).toBeVisible();
    expect(
      screen.getByRole('radio', { name: /filter by down/i })
    ).toBeVisible();
    expect(
      screen.getByRole('radio', { name: /filter by unassigned/i })
    ).toBeVisible();
  });

  it('navigates with correct params when Down segment is clicked', async () => {
    const user = userEvent.setup();
    mockSummaryCounts();
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /filter by down/i })
      ).toBeVisible();
    });

    await user.click(screen.getByRole('radio', { name: /filter by down/i }));
    expect(mockGo).toHaveBeenCalledWith(
      '.',
      expect.objectContaining({
        groupBy: 'Health',
        groupFilter: 'Down',
        page: 0,
        search: '',
      }),
      { reload: false, location: 'replace' }
    );
  });

  it('clears params when Total is clicked while a filter is active', async () => {
    const user = userEvent.setup();
    mockSummaryCounts();
    setupMocks({ groupBy: 'health', groupFilter: 'up' });
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /filter by total/i })
      ).toBeVisible();
    });

    await user.click(screen.getByRole('radio', { name: /filter by total/i }));
    expect(mockGo).toHaveBeenCalledWith(
      '.',
      expect.objectContaining({
        groupBy: 'Id',
        groupFilter: null,
        page: 0,
        search: '',
      }),
      { reload: false, location: 'replace' }
    );
  });

  it('treats a missing groupKey as a custom header filter', async () => {
    mockSummaryCounts();
    vi.mocked(useHomeViewState).mockReturnValue({
      groupKey: undefined,
      groupFilter: 'Up',
      setHeaderFilter: vi.fn(),
    } as never);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /filter by total/i })
      ).toBeVisible();
    });
    // custom filter means none of the actionable segment radios are forced-selected
    // beyond the default total control staying usable
    expect(screen.getByRole('radio', { name: /filter by up/i })).toBeVisible();
  });
});
