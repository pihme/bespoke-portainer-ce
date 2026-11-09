import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { ClientSidePagination, ServerSidePagination } from './SortableList.stories';

vi.mock('@reach/menu-button');

describe('SortableList.stories (backwards compatibility)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('ClientSidePagination renders produce items and allows sorting by category', async () => {
    const user = userEvent.setup();
    const Wrapped = withTestQueryProvider(ClientSidePagination);
    render(<Wrapped />);

    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter fruits & veggies...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Category/i }));
    await user.click(screen.getByRole('menuitem', { name: /Fruit/i }));

    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('ServerSidePagination loads produce items after the simulated latency', async () => {
    const Wrapped = withTestQueryProvider(ServerSidePagination);
    render(<Wrapped />);

    // default page size 10 keeps the first color groups only (Banana is later)
    expect(
      await screen.findByText('Apple', {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });
});
