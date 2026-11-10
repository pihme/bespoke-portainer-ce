import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockEnvironment } from '@/react-tools/test-mocks';
import { Environment } from '@/react/portainer/environments/types';

import { EnvSelector, getEnvironmentOptions } from './EnvSelector';

describe('EnvSelector', () => {
  it('should render when environment options are available', async () => {
    const mockEnvironments = [
      createMockEnvironment({
        Id: 1,
        Name: 'Environment 1',
        GroupId: 1,
      }),
      createMockEnvironment({
        Id: 2,
        Name: 'Environment 2',
        GroupId: 1,
      }),
    ];

    renderComponent({
      environments: mockEnvironments,
    });
    await waitFor(() => {
      // render select
      const select = screen.getByRole('combobox');
      expect(select).toBeVisible();

      // placeholder text
      expect(screen.getByText('Select an environment')).toBeVisible();

      // no error displayed
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // data-cy
      expect(
        screen.getByTestId('stack-duplicate-environment-select')
      ).toBeInTheDocument();
    });
  });

  it('should return null when no environment options exist', async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('should display FormError when error prop is provided', async () => {
    const mockEnvironments = [
      createMockEnvironment({
        Id: 1,
        Name: 'Environment 1',
        GroupId: 1,
      }),
    ];

    const error = 'Environment is required';

    renderComponent({
      environments: mockEnvironments,
      error,
    });

    await waitFor(() => {
      expect(screen.getByRole('alert', { name: error })).toBeVisible();
    });
  });

  function renderComponent({
    environments = [],
    onChange = vi.fn(),
    error,
  }: {
    environments?: Environment[];
    onChange?: (value: number | undefined) => void;
    error?: string;
  } = {}) {
    const Component = withTestQueryProvider(EnvSelector);

    server.use(
      http.get('/api/endpoints', () => HttpResponse.json(environments)),
      // REQ-TAI-013: the groups API is gone; the selector must not need it
      http.get(
        '/api/endpoint_groups',
        () => new HttpResponse(null, { status: 404 })
      )
    );

    return render(
      <Component value={undefined} onChange={onChange} error={error} />
    );
  }
});

describe('getEnvironmentOptions', () => {
  it('should return empty array when no environments are provided', () => {
    expect(getEnvironmentOptions([])).toEqual([]);
  });

  it('should exclude current environment when currentEnvironmentId is provided', () => {
    const environments = [
      createMockEnvironment({ Id: 1, Name: 'Env 1', GroupId: 1 }),
      createMockEnvironment({ Id: 2, Name: 'Env 2', GroupId: 1 }),
    ];

    expect(getEnvironmentOptions(environments, 1)).toEqual([
      { label: 'Env 2', value: 2 },
    ]);
  });

  it('REQ-TAI-013 lists environments flat and sorted by name, ignoring GroupId', () => {
    const environments = [
      createMockEnvironment({ Id: 3, Name: 'Env 3', GroupId: 2 }),
      createMockEnvironment({ Id: 1, Name: 'Env 1', GroupId: 1 }),
      createMockEnvironment({ Id: 2, Name: 'Env 2', GroupId: 7 }),
    ];

    expect(getEnvironmentOptions(environments)).toEqual([
      { label: 'Env 1', value: 1 },
      { label: 'Env 2', value: 2 },
      { label: 'Env 3', value: 3 },
    ]);
  });
});
