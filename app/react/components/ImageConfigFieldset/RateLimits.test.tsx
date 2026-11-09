import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { EnvironmentType } from '@/react/portainer/environments/types';
import { RegistryTypes } from '@/react/portainer/registries/types/registry';
import { server } from '@/setup-tests/server';

import { RateLimits } from './RateLimits';

const useRegistry = vi.fn();
const useCurrentEnvironment = vi.fn();
const useCurrentUser = vi.fn();

vi.mock('@/react/portainer/registries/queries/useRegistry', () => ({
  useRegistry: (...args: unknown[]) => useRegistry(...args),
}));
vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: (...args: unknown[]) => useCurrentEnvironment(...args),
}));
vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: (...args: unknown[]) => useCurrentUser(...args),
}));
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const localEnv = {
  Id: 1,
  Type: EnvironmentType.Docker,
  URL: 'unix:///var/run/docker.sock',
  Name: 'local',
};

describe('REQ-IMG-02 RateLimits for local Docker Hub pulls', () => {
  beforeEach(() => {
    useRegistry.mockReset();
    useCurrentEnvironment.mockReset();
    useCurrentUser.mockReset();
    useCurrentUser.mockReturnValue({ isPureAdmin: true });
    useCurrentEnvironment.mockReturnValue({ data: localEnv });
  });

  it('returns null while loading or for non-DockerHub registries', () => {
    useRegistry.mockReturnValue({
      data: undefined,
      isInitialLoading: true,
    });
    const Wrapped = withTestQueryProvider(RateLimits);
    const { container, rerender } = render(
      <Wrapped registryId={1} onRateLimit={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();

    useRegistry.mockReturnValue({
      data: { Type: RegistryTypes.CUSTOM, Authentication: false },
      isInitialLoading: false,
    });
    rerender(<Wrapped registryId={1} onRateLimit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows remaining anonymous admin pulls for a local environment', async () => {
    const onRateLimit = vi.fn();
    useRegistry.mockReturnValue({
      data: {
        Type: RegistryTypes.DOCKERHUB,
        Authentication: false,
      },
      isInitialLoading: false,
    });
    server.use(
      http.get('/api/endpoints/1/dockerhub/1', () =>
        HttpResponse.json({ remaining: 80, limit: 100 })
      )
    );

    const Wrapped = withTestQueryProvider(RateLimits);
    render(<Wrapped registryId={1} onRateLimit={onRateLimit} />);

    expect(
      await screen.findByText(/anonymous account to pull images/i)
    ).toBeVisible();
    expect(screen.getByText('80/100')).toBeVisible();
    expect(screen.getByText('Registries View')).toBeVisible();
    await waitFor(() => {
      expect(onRateLimit).toHaveBeenCalledWith(false);
    });
  });

  it('shows exceeded quota messaging when remaining is zero', async () => {
    useRegistry.mockReturnValue({
      data: {
        Type: RegistryTypes.DOCKERHUB,
        Authentication: true,
      },
      isInitialLoading: false,
    });
    server.use(
      http.get('/api/endpoints/1/dockerhub/1', () =>
        HttpResponse.json({ remaining: 0, limit: 200 })
      )
    );

    const Wrapped = withTestQueryProvider(RateLimits);
    render(<Wrapped registryId={1} onRateLimit={vi.fn()} />);

    expect(
      await screen.findByText(/pull count quota as a free user is now exceeded/i)
    ).toBeVisible();
  });

  it('tells non-admin users to contact an administrator', async () => {
    useCurrentUser.mockReturnValue({ isPureAdmin: false });
    useRegistry.mockReturnValue({
      data: {
        Type: RegistryTypes.ANONYMOUS,
        Authentication: false,
      },
      isInitialLoading: false,
    });
    server.use(
      http.get('/api/endpoints/1/dockerhub/1', () =>
        HttpResponse.json({ remaining: 10, limit: 100 })
      )
    );

    const Wrapped = withTestQueryProvider(RateLimits);
    render(<Wrapped registryId={1} onRateLimit={vi.fn()} />);

    expect(
      await screen.findByText(/Contact your administrator/i)
    ).toBeVisible();
  });
});
