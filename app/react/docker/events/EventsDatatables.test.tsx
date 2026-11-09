import { render, screen, within } from '@testing-library/react';
import { EventMessage } from 'docker-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isoDateFromTimestamp } from '@/portainer/filters/filters';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { EventsDatatable, columns } from './EventsDatatables';

// Production store sorts by id "Time" while the column id is "time"; override so
// TanStack Table does not console.error when rows are present.
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

function makeEvent(overrides: Partial<EventMessage> = {}): EventMessage {
  return {
    Type: 'container',
    Action: 'start',
    time: 1_700_000_000,
    Actor: {
      ID: 'cid',
      Attributes: { name: 'nginx', exitCode: '0' },
    },
    ...overrides,
  };
}

function renderDatatable(dataset?: EventMessage[]) {
  const Wrapped = withUserProvider(() => (
    <EventsDatatable dataset={dataset} />
  ));
  return render(<Wrapped />);
}

describe('REQ-HOST-05 EventsDatatable', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('shows the Events title and loading state when dataset is undefined', () => {
    renderDatatable(undefined);

    expect(screen.getByRole('heading', { name: 'Events' })).toBeVisible();
    expect(screen.getByText(/Loading/i)).toBeVisible();
  });

  it('renders an empty table when the dataset is an empty array', () => {
    renderDatatable([]);

    expect(screen.getByText(/No items available/i)).toBeVisible();
    expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
  });

  it('renders Date, Type and Details columns for each event', () => {
    const events = [
      makeEvent({
        Type: 'container',
        Action: 'start',
        time: 1_700_000_000,
        Actor: { ID: 'c1', Attributes: { name: 'web' } },
      }),
      makeEvent({
        Type: 'image',
        Action: 'pull',
        time: 1_700_000_100,
        Actor: { ID: 'sha256:abc', Attributes: {} },
      }),
      makeEvent({
        Type: 'network',
        Action: 'create',
        time: 1_700_000_200,
        Actor: { ID: 'n1', Attributes: { name: 'bridge' } },
      }),
    ];

    renderDatatable(events);

    const table = screen.getByTestId('docker-events-datatable');
    expect(within(table).getByText('Date')).toBeVisible();
    expect(within(table).getByText('Type')).toBeVisible();
    expect(within(table).getByText('Details')).toBeVisible();

    expect(within(table).getByText('container')).toBeVisible();
    expect(within(table).getByText('image')).toBeVisible();
    expect(within(table).getByText('network')).toBeVisible();

    expect(within(table).getByText('Container web started')).toBeVisible();
    expect(within(table).getByText('Image sha256:abc pulled')).toBeVisible();
    expect(within(table).getByText('Network bridge created')).toBeVisible();

    expect(
      within(table).getByText(isoDateFromTimestamp(1_700_000_000))
    ).toBeVisible();
  });

  it('exposes three column definitions with Date, Type and Details headers', () => {
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.header)).toEqual(['Date', 'Type', 'Details']);
  });
});
