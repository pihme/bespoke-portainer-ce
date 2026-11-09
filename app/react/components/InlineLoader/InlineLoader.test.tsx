import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineLoader } from './InlineLoader';

describe('InlineLoader', () => {
  it('renders children with the default size', () => {
    render(<InlineLoader>Refreshing</InlineLoader>);
    expect(screen.getByText('Refreshing')).toBeVisible();
  });

  it('applies size and className variants', () => {
    const { container } = render(
      <InlineLoader size="md" className="extra">
        Loading more
      </InlineLoader>
    );
    expect(screen.getByText('Loading more')).toBeVisible();
    expect(container.firstChild).toHaveClass('extra');
  });
});
