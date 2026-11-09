import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SortableListSkeleton } from './SortableListSkeleton';

describe('SortableListSkeleton (backwards compatibility)', () => {
  it('renders five pulse rows by default', () => {
    const { container } = render(<SortableListSkeleton />);
    expect(container.querySelectorAll('.animate-pulse > div')).toHaveLength(5);
  });

  it('renders the requested number of rows, cycling width classes', () => {
    const { container } = render(<SortableListSkeleton rows={7} />);
    expect(container.querySelectorAll('.animate-pulse > div')).toHaveLength(7);
  });
});
