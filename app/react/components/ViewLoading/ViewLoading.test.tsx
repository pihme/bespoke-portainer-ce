import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ViewLoading } from './ViewLoading';

describe('ViewLoading', () => {
  it('renders the loading animation without a message', () => {
    const { container } = render(<ViewLoading />);
    expect(container.querySelector('.sk-fold')).toBeTruthy();
    expect(screen.queryByText(/.+/)).toBeNull();
  });

  it('renders an optional message beside the animation', () => {
    render(<ViewLoading message="Loading stacks..." />);
    expect(screen.getByText('Loading stacks...')).toBeVisible();
  });
});
