import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VerticalSeparator } from './VerticalSeparator';

describe('VerticalSeparator', () => {
  it('renders a decorative separator with an optional className', () => {
    const { container } = render(<VerticalSeparator className="sep" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('sep');
  });
});
