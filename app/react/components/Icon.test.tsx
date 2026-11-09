import { render, screen } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { Icon } from './Icon';

describe('Icon', () => {
  it('renders a lucide component icon with mode and size classes', () => {
    const { container } = render(
      <Icon icon={Plus} mode="primary" size="md" className="extra" />
    );
    const icon = container.querySelector('[role="img"]');
    expect(icon).toHaveClass('icon-primary', 'icon-md', 'extra');
  });

  it('renders a ReactNode icon inside a span', () => {
    render(<Icon icon={<span data-cy="node-icon">★</span>} />);
    expect(screen.getByText('★')).toBeVisible();
  });

  it('renders an svg-* icon via Svg', () => {
    const { container } = render(<Icon icon="svg-docker" spin />);
    const wrap = container.querySelector('.animate-spin-slow');
    expect(wrap).toBeTruthy();
  });

  it('renders a lucide icon from a kebab-case string name', () => {
    const { container } = render(<Icon icon="plus" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('logs and returns null for an unknown string icon', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<Icon icon="not-a-real-icon-name-zzz" />);
    expect(container).toBeEmptyDOMElement();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
