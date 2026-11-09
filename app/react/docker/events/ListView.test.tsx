import { render, screen, within } from '@testing-library/react';
import { EventMessage } from 'docker-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { useEvents } from '../proxy/queries/useEvents';

import { ListView } from './ListView';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 7,
}));

vi.mock('../proxy/queries/useEvents', () => ({
  useEvents: vi.fn(),
}));

// Production EventsDatatable store sorts by id "Time" while the column id is
// "time"; override so TanStack Table does not console.error when rows render.
vi.mock('@@/datatables/useTableState', () => ({
  useTableState: () => ({
    pageSize: 10,
    search: '',
    sortBy: { id: 'time', desc: true },
    setSearch: vi.fn(),
    setSortBy: vi.fn(),
    setPageSize: vi.fn(),
  }),
}));

const mockUseEvents = vi.mocked(useEvents);

describe('REQ-HOST-05 ListView', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockUseEvents.mockReset();
  });

  it('renders the event list header and passes events into the datatable', () => {
    const dataset: EventMessage[] = [
      {
        Type: 'container',
        Action: 'start',
        time: 1_700_000_000,
        Actor: { ID: 'c1', Attributes: { name: 'api' } },
      },
    ];
    mockUseEvents.mockReturnValue({
      data: dataset,
      isLoading: false,
    } as ReturnType<typeof useEvents>);

    renderComponent();

    expect(screen.getByTestId('page-title')).toHaveTextContent(/event list/i);

    const table = screen.getByTestId('docker-events-datatable');
    expect(within(table).getByText('Container api started')).toBeVisible();
    expect(within(table).getByText('container')).toBeVisible();
  });

  it('shows the datatable loading state while events are undefined', () => {
    mockUseEvents.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useEvents>);

    renderComponent();

    expect(screen.getByTestId('page-title')).toHaveTextContent(/event list/i);
    expect(screen.getByText(/Loading/i)).toBeVisible();
  });

  it('queries engine events for the current environment with a 24h window', () => {
    mockUseEvents.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useEvents>);

    const before = Math.floor(Date.now() / 1000);
    renderComponent();
    const after = Math.floor(Date.now() / 1000);

    expect(mockUseEvents).toHaveBeenCalledTimes(1);
    const [envId, options] = mockUseEvents.mock.calls[0];
    expect(envId).toBe(7);
    const { since, until } = options!.params!;
    expect(until).toBeGreaterThanOrEqual(before);
    expect(until).toBeLessThanOrEqual(after);
    expect(since).toBeGreaterThanOrEqual(until! - 24 * 60 * 60 - 2);
    expect(since).toBeLessThanOrEqual(until! - 24 * 60 * 60 + 2);
  });
});

function renderComponent() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ListView))
  );
  return render(<Wrapped />);
}
