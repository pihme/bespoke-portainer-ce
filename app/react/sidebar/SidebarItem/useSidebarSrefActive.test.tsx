import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { useSidebarSrefActive } from './useSidebarSrefActive';

const stateName = { current: 'docker.containers' };

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useCurrentStateAndParams: () => ({
      state: { name: stateName.current },
      params: {},
    }),
    useSrefActive: () => ({
      href: '#/docker/containers',
      onClick: vi.fn(),
      className: 'bg-graphite-500',
    }),
  };
});

describe('useSidebarSrefActive', () => {
  it('returns empty className when current route is ignored', () => {
    stateName.current = 'docker.templates.custom';
    const { result } = renderHook(() =>
      useSidebarSrefActive('docker.templates', undefined, {}, {}, {
        ignorePaths: ['docker.templates.custom'],
      })
    );
    expect(result.current.className).toBe('');
  });

  it('forces active class when current route is included', () => {
    stateName.current = 'portainer.wizard.endpoints';
    const { result } = renderHook(() =>
      useSidebarSrefActive('portainer.endpoints', 'active-class', {}, {}, {
        includePaths: ['portainer.wizard.endpoints'],
      })
    );
    expect(result.current.className).toBe('active-class');
  });

  it('passes through anchor props when no path options match', () => {
    stateName.current = 'docker.containers';
    const { result } = renderHook(() =>
      useSidebarSrefActive('docker.containers')
    );
    expect(result.current.className).toBe('bg-graphite-500');
    expect(result.current.href).toBe('#/docker/containers');
  });
});
