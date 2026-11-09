import { render } from '@testing-library/react';
import { User } from 'lucide-react';
import { vi } from 'vitest';

import { BadgeIcon, BadgeSize } from './BadgeIcon';

vi.mock('@@/Icon', () => ({
  Icon: ({ className }: { className?: string }) => (
    <span data-cy="badge-inner" className={className} />
  ),
}));

const sizeClass: Record<BadgeSize, string> = {
  md: 'h-6',
  lg: 'h-8',
  xl: 'h-10',
  '2xl': 'h-12',
  '3xl': 'h-14',
};

describe('BadgeIcon', () => {
  it('defaults to 3xl size classes', () => {
    const { container } = render(<BadgeIcon icon={User} />);
    expect(container.firstChild).toHaveClass('h-14', 'w-14', 'text-3xl');
  });

  it.each(Object.keys(sizeClass) as BadgeSize[])(
    'applies %s size classes',
    (size) => {
      const { container } = render(<BadgeIcon icon={User} size={size} />);
      expect(container.firstChild).toHaveClass(sizeClass[size]);
    }
  );

  it('falls back to 3xl for an unknown size', () => {
    const { container } = render(
      // force default branch
      <BadgeIcon icon={User} size={'tiny' as BadgeSize} />
    );
    expect(container.firstChild).toHaveClass('h-14', 'w-14', 'text-3xl');
  });

  it('forwards iconClass to the inner Icon', () => {
    render(<BadgeIcon icon={User} iconClass="custom-icon" />);
    expect(document.querySelector('[data-cy="badge-inner"]')).toHaveClass(
      'custom-icon'
    );
  });
});
