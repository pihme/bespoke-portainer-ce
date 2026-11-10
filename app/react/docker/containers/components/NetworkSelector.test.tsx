import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));
vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));
vi.mock('@/react/docker/networks/queries/useNetworks', () => ({
  useNetworks: vi.fn(
    (
      _id: number,
      _params: unknown,
      opts?: { select?: (n: Array<{ Name: string }>) => unknown }
    ) => {
      const raw = [{ Name: 'bridge' }, { Name: 'host' }, { Name: 'none' }];
      return {
        data: opts?.select ? opts.select(raw) : raw,
        isLoading: false,
      };
    }
  ),
}));
vi.mock('@@/form-components/PortainerSelect', () => ({
  PortainerSelect: ({
    options,
    value,
    onChange,
    'data-cy': dataCy,
  }: {
    options: Array<{ label: string; value: string }>;
    value: string;
    onChange: (v: string) => void;
    'data-cy'?: string;
  }) => (
    <select
      data-cy={dataCy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { useNetworks } from '@/react/docker/networks/queries/useNetworks';

import { NetworkSelector, useNetworksForSelector } from './NetworkSelector';

describe('NetworkSelector', () => {
  it('renders sorted network options and hides selected networks', () => {
    render(
      <NetworkSelector
        value="bridge"
        onChange={vi.fn()}
        hiddenNetworks={['none']}
        additionalOptions={[{ label: 'custom', value: 'custom' }]}
      />
    );
    expect(screen.getByTestId('docker-network-selector')).toHaveValue('bridge');
    expect(
      screen.queryByRole('option', { name: 'none' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'custom' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'bridge' })).toBeInTheDocument();
  });

  it('useNetworksForSelector requests local networks', () => {
    renderHook(() => useNetworksForSelector());
    expect(useNetworks).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ local: true }),
      expect.any(Object)
    );
  });

  it('REQ-TAI-017 useNetworksForSelector never asks for Swarm attachable networks', () => {
    renderHook(() => useNetworksForSelector());
    expect(useNetworks).toHaveBeenLastCalledWith(
      1,
      { local: true },
      expect.any(Object)
    );
  });
});
