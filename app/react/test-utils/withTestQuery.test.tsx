import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from './withTestQuery';

function QueryProbe() {
  const { data } = useQuery({
    queryKey: ['probe'],
    queryFn: async () => 'ok',
  });
  return <div>{data}</div>;
}

describe('withTestQueryProvider', () => {
  it('provides a query client that resolves queries', async () => {
    const Wrapped = withTestQueryProvider(QueryProbe);
    render(<Wrapped />);
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });

  it('accepts optional query and mutation error handlers', async () => {
    const Wrapped = withTestQueryProvider(QueryProbe, {
      onQueryError: vi.fn(),
      onMutationError: vi.fn(),
    });
    render(<Wrapped />);
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });
});
