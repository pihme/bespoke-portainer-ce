import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SortableListBody } from './SortableListBody';
import { SortableGroup } from './SortableListGroup';

type Item = { id: number; name: string };

const GROUPS: SortableGroup<Item>[] = [
  {
    key: 'a',
    label: 'Group A',
    description: 'desc',
    icon: <span>★</span>,
    items: [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
    ],
  },
  { key: 'b', label: 'Group B', items: [{ id: 3, name: 'Three' }] },
];

describe('SortableListBody (backwards compatibility)', () => {
  it('shows the skeleton when loading with no groups', () => {
    const { container } = render(
      <SortableListBody
        isLoading
        groups={[]}
        showGroupHeaders={false}
        renderItem={(item) => <div>{item.name}</div>}
        emptyMessage="empty"
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('blurs existing groups and shows a spinner while loading', () => {
    const { container } = render(
      <SortableListBody
        isLoading
        groups={GROUPS}
        showGroupHeaders
        renderItem={(item) => <div>{item.name}</div>}
        emptyMessage="empty"
      />
    );

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(container.querySelector('.blur-sm')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin-slow')).toBeInTheDocument();
  });

  it('renders groups with headers, column headers, and custom item keys', () => {
    const getItemKey = vi.fn((item: Item) => `k-${item.id}`);
    const renderColumnHeaders = vi.fn((key: string) => (
      <div>cols-{key}</div>
    ));

    render(
      <SortableListBody
        isLoading={false}
        groups={GROUPS}
        showGroupHeaders
        renderItem={(item) => <div>{item.name}</div>}
        renderColumnHeaders={renderColumnHeaders}
        getItemKey={getItemKey}
        emptyMessage="empty"
        data-cy="body"
      />
    );

    expect(screen.getByText('Group A')).toBeInTheDocument();
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByText('★')).toBeInTheDocument();
    expect(screen.getByText('cols-a')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(getItemKey).toHaveBeenCalled();
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('falls back to the group key when the label is empty', () => {
    render(
      <SortableListBody
        isLoading={false}
        groups={[{ key: 'orphan', label: '', items: [{ id: 9, name: 'X' }] }]}
        showGroupHeaders
        renderItem={(item) => <div>{item.name}</div>}
        emptyMessage="empty"
      />
    );

    expect(screen.getByText('orphan')).toBeInTheDocument();
  });

  it('shows the empty message when not loading and groups are empty', () => {
    render(
      <SortableListBody
        isLoading={false}
        groups={[]}
        showGroupHeaders={false}
        renderItem={() => null}
        emptyMessage="Nothing here"
      />
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
