import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

const notifySuccess = vi.fn();
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

import { ExperimentalFeatures } from './ExperimentalFeatures';
import { ExperimentalFeaturesSettingsForm } from './ExperimentalFeaturesForm';

describe('REQ-SET-05 ExperimentalFeatures', () => {
  it('renders nothing while settings are loading', () => {
    server.use(
      http.get('/api/settings/experimental', () => new Promise(() => {}))
    );
    const Wrapped = withTestQueryProvider(ExperimentalFeatures);
    const { container } = render(<Wrapped />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the experimental features widget when settings load', async () => {
    server.use(
      http.get('/api/settings/experimental', () =>
        HttpResponse.json({ experimentalFeatures: {} })
      )
    );
    const Wrapped = withTestQueryProvider(ExperimentalFeatures);
    render(<Wrapped />);
    expect(
      await screen.findByRole('heading', { name: /experimental features/i })
    ).toBeVisible();
    expect(screen.getByTestId('settings-experimentalButton')).toBeDisabled();
  });

  it('saves experimental settings on form submit', async () => {
    notifySuccess.mockClear();
    let putBody: unknown;
    server.use(
      http.put('/api/settings/experimental', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ experimentalFeatures: {} });
      })
    );

    const Wrapped = withTestQueryProvider(() => (
      <ExperimentalFeaturesSettingsForm settings={{} as never} />
    ));
    render(<Wrapped />);

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'Success',
        'Successfully updated experimental features settings'
      )
    );
    expect(putBody).toEqual({});
  });
});
