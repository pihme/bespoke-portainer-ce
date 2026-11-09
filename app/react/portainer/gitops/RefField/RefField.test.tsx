import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import * as featureFlags from '@/react/portainer/feature-flags/feature-flags.service';

import { RefField, refFieldValidation } from './RefField';
import { RefSelector } from './RefSelector';

describe('REQ-GIT-02 RefField', () => {
  beforeEach(() => {
    vi.spyOn(featureFlags, 'isBE', 'get').mockReturnValue(false);
  });

  it('edits a free-text reference in CE', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RefField value="refs/heads/main" onChange={onChange} error="bad" />
    );

    expect(screen.getByText(/repository reference/i)).toBeVisible();
    const input = screen.getByTestId('repository-reference-input');
    await user.clear(input);
    await user.type(input, 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('builds a CE validation schema that allows empty refs', async () => {
    vi.spyOn(featureFlags, 'isBE', 'get').mockReturnValue(false);
    await expect(refFieldValidation().validate('')).resolves.toBe('');
    await expect(
      refFieldValidation().validate('refs/heads/main')
    ).resolves.toBe('refs/heads/main');
  });

  it('renders RefSelector on BE', async () => {
    vi.spyOn(featureFlags, 'isBE', 'get').mockReturnValue(true);
    server.use(
      http.post('/api/gitops/repo/refs', () =>
        HttpResponse.json(['refs/heads/main', 'refs/heads/dev'])
      )
    );
    const Wrapped = withTestQueryProvider(() => (
      <RefField value="refs/heads/main" onChange={() => {}} sourceId={3} />
    ));
    render(<Wrapped />);
    expect(await screen.findByTestId('component-gitRefInput')).toBeVisible();
  });
});

describe('REQ-GIT-02 RefSelector', () => {
  it('orders main/master first and selects first when value missing', async () => {
    const onChange = vi.fn();
    server.use(
      http.post('/api/gitops/repo/refs', () =>
        HttpResponse.json([
          'refs/heads/dev',
          'refs/heads/master',
          'refs/heads/main',
        ])
      )
    );
    const Wrapped = withTestQueryProvider(() => (
      <RefSelector
        sourceId={1}
        value="refs/heads/missing"
        onChange={onChange}
        inputId="ref"
      />
    ));
    render(<Wrapped />);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toBe('refs/heads/master');
  });

  it('falls back to main when repository has no refs', async () => {
    server.use(http.post('/api/gitops/repo/refs', () => HttpResponse.json([])));
    const Wrapped = withTestQueryProvider(() => (
      <RefSelector
        sourceId={1}
        value="refs/heads/main"
        onChange={() => {}}
        inputId="ref"
      />
    ));
    render(<Wrapped />);
    expect(await screen.findByTestId('component-gitRefInput')).toBeVisible();
  });
});
