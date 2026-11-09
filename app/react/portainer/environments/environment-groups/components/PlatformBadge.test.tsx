import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlatformBadge } from './PlatformBadge';

vi.mock('../utils/getPlatformLabel', () => ({
  getPlatformLabel: vi.fn(() => 'Docker'),
}));

import { getPlatformLabel } from '../utils/getPlatformLabel';

describe('PlatformBadge', () => {
  it('renders the platform label with known color', () => {
    render(
      <PlatformBadge
        group={{ Id: 1, Name: 'Default', Description: '', EndpointIds: [] } as never}
      />
    );
    expect(screen.getByTestId('environment-group-platform_Default')).toHaveTextContent(
      'Docker'
    );
    expect(getPlatformLabel).toHaveBeenCalled();
  });

  it('falls back to gray when the platform label is unknown', () => {
    vi.mocked(getPlatformLabel).mockReturnValue('Weird');
    render(
      <PlatformBadge
        group={{ Id: 2, Name: 'Other', Description: '', EndpointIds: [] } as never}
      />
    );
    const badge = screen.getByTestId('environment-group-platform_Other');
    expect(badge).toHaveTextContent('Weird');
    expect(badge.className).toContain('bg-gray-2');
  });
});
