import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

import { notifySuccess } from '@/portainer/services/notifications';

import { HiddenContainersPanel } from './HiddenContainersPanel';

const settings = {
  BlackListedLabels: [{ name: 'com.example.hide', value: '1' }],
};

describe('HiddenContainersPanel', () => {
  it('returns null while settings are loading', () => {
    server.use(
      http.get('/api/settings', () => new Promise(() => {}))
    );
    const Wrapped = withTestQueryProvider(HiddenContainersPanel);
    const { container } = render(<Wrapped />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists labels and adds a filter', async () => {
    let putBody: unknown;
    server.use(
      http.get('/api/settings', () => HttpResponse.json(settings)),
      http.put('/api/settings', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({
          ...settings,
          BlackListedLabels: [
            ...settings.BlackListedLabels,
            { name: 'com.example.foo', value: 'bar' },
          ],
        });
      })
    );

    const Wrapped = withTestQueryProvider(HiddenContainersPanel);
    render(<Wrapped />);

    expect(await screen.findByText('Hidden containers')).toBeInTheDocument();
    expect(screen.getByText('com.example.hide')).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText('e.g. com.example.foo'),
      'com.example.foo'
    );
    await userEvent.type(screen.getByPlaceholderText('e.g. bar'), 'bar');
    await userEvent.click(
      screen.getByTestId('hidden-containersadd-label-button')
    );

    await waitFor(() =>
      expect(putBody).toMatchObject({
        BlackListedLabels: expect.arrayContaining([
          { name: 'com.example.foo', value: 'bar' },
        ]),
      })
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
  });

  it('deletes a label filter', async () => {
    let putBody: unknown;
    server.use(
      http.get('/api/settings', () => HttpResponse.json(settings)),
      http.put('/api/settings', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ ...settings, BlackListedLabels: [] });
      })
    );

    const Wrapped = withTestQueryProvider(HiddenContainersPanel);
    render(<Wrapped />);
    expect(await screen.findByText('com.example.hide')).toBeInTheDocument();

    await userEvent.click(
      screen.getByTestId('hidden-containers-remove-filter-button')
    );

    await waitFor(() =>
      expect(putBody).toMatchObject({ BlackListedLabels: [] })
    );
  });
});
