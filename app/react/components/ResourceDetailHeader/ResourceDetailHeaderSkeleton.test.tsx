import { render, screen } from '@testing-library/react';

import { ResourceDetailHeaderSkeleton } from './ResourceDetailHeaderSkeleton';

describe('ResourceDetailHeaderSkeleton', () => {
  it('renders the pulse skeleton with an action bar by default', () => {
    const { container } = render(<ResourceDetailHeaderSkeleton />);

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    // Action bar shell placeholders
    expect(container.querySelectorAll('.h-8').length).toBeGreaterThan(0);
  });

  it('renders the requested number of stat block placeholders', () => {
    const { container, rerender } = render(
      <ResourceDetailHeaderSkeleton statBlockCount={2} />
    );

    expect(
      container.querySelectorAll('.min-w-\\[6rem\\]').length
    ).toBe(2);

    rerender(<ResourceDetailHeaderSkeleton statBlockCount={1} />);
    expect(
      container.querySelectorAll('.min-w-\\[6rem\\]').length
    ).toBe(1);

    rerender(<ResourceDetailHeaderSkeleton statBlockCount={0} />);
    expect(
      container.querySelectorAll('.min-w-\\[6rem\\]').length
    ).toBe(0);
  });

  it('omits the action bar when hasActionBar is false', () => {
    const { container } = render(
      <ResourceDetailHeaderSkeleton hasActionBar={false} />
    );

    expect(container.querySelectorAll('.h-8.w-28').length).toBe(0);
  });
});
