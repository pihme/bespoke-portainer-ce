import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Check } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironment: () => ({ data: true }),
}));

vi.mock('@/react/docker/components/ImageStatus/helpers', () => ({
  statusIcon: () => Check,
}));

import { StackImageStatus } from './StackImageStatus';

describe('StackImageStatus', () => {
  it('shows a spinner while loading then the status icon', async () => {
    server.use(
      http.get('/api/stacks/:id/images_status', async () => {
        await new Promise((r) => setTimeout(r, 30));
        return HttpResponse.json({ Status: 'updated' });
      })
    );

    const Wrapped = withTestQueryProvider(() => (
      <StackImageStatus stackId={5} environmentId={1} />
    ));
    const { container } = render(<Wrapped />);
    expect(container.querySelector('.animate-spin-slow')).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector('.animate-spin-slow')).toBeNull();
    });
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders nothing when the query errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('/api/stacks/:id/images_status', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );

    const Wrapped = withTestQueryProvider(() => (
      <StackImageStatus stackId={6} environmentId={1} />
    ));
    const { container } = render(<Wrapped />);
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
