import { render, screen } from '@testing-library/react';

import {
  PlatformBadge,
  StatusBadge,
  TypeBadge,
} from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['healthy', 'Healthy'],
    ['error', 'Error'],
    ['syncing', 'Syncing'],
    ['paused', 'Paused'],
    ['unknown', 'Unknown'],
  ] as const)('renders %s status label', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});

describe('TypeBadge', () => {
  it('renders stack type label', () => {
    render(<TypeBadge type="stack" />);
    expect(screen.getByText('Stack')).toBeVisible();
  });
});

describe('PlatformBadge', () => {
  it('renders docker standalone and swarm labels', () => {
    const { rerender } = render(
      <PlatformBadge platform="dockerStandalone" />
    );
    expect(screen.getByText('Docker Standalone')).toBeVisible();

    rerender(<PlatformBadge platform="dockerSwarm" />);
    expect(screen.getByText('Docker Swarm')).toBeVisible();
  });

  it('renders Unknown when platform is undefined', () => {
    render(<PlatformBadge platform={undefined} />);
    expect(screen.getByText('Unknown')).toBeVisible();
  });
});
