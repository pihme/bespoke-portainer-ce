import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  current: { data: { docs: '/wip/docker/containers' } } as
    | { data?: { docs?: string } }
    | null,
}));

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({ state: state.current }),
}));

vi.mock('@/react/portainer/system/useSystemVersion', () => ({
  useSystemVersion: () => ({ data: { VersionSupport: 'LTS' } }),
}));

import { ContextHelp, useDocsUrl } from './ContextHelp';

describe('ContextHelp', () => {
  it('links to versioned docs for the current state', () => {
    state.current = { data: { docs: '/wip/docker/containers' } };
    render(<ContextHelp />);
    expect(screen.getByTestId('context-help-button')).toHaveAttribute(
      'href',
      'https://docs.portainer.io/lts/wip/docker/containers'
    );
  });

  it('builds docs urls from an explicit path', () => {
    state.current = { data: {} };
    const { result } = renderHook(() => useDocsUrl('/user/docker'));
    expect(result.current).toBe('https://docs.portainer.io/lts/user/docker');
  });

  it('returns an empty string when there is no doc and no state', () => {
    state.current = null;
    const { result } = renderHook(() => useDocsUrl());
    expect(result.current).toBe('');
  });
});
