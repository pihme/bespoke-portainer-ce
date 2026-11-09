import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../feature-flags/withEdition', () => ({
  withEdition: (Component: React.ComponentType) => Component,
}));

const useCurrentEnvironment = vi.fn();

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: (...args: unknown[]) =>
    useCurrentEnvironment(...args),
}));

import { TimeWindowDisplay } from './TimeWindowDisplay';

describe('TimeWindowDisplay local helpers (backwards compatibility)', () => {
  it('renders nothing when environment data is missing or change window disabled', () => {
    useCurrentEnvironment.mockReturnValue({ data: undefined });
    const { rerender, container } = render(<TimeWindowDisplay />);
    expect(container).toBeEmptyDOMElement();

    useCurrentEnvironment.mockReturnValue({
      data: { ChangeWindow: { Enabled: false } },
    });
    rerender(<TimeWindowDisplay />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the UTC and local change window tip when enabled', () => {
    useCurrentEnvironment.mockReturnValue({
      data: {
        ChangeWindow: {
          Enabled: true,
          StartTime: '09:00',
          EndTime: '17:00',
        },
      },
    });
    render(<TimeWindowDisplay />);
    expect(
      screen.getByText(/A change window is enabled/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/UTC/i)).toBeInTheDocument();
  });
});
