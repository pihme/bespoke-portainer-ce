import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SortableListItem } from './SortableListItem';

describe('SortableListItem (backwards compatibility)', () => {
  it('renders children inside a bordered row', () => {
    render(
      <SortableListItem>
        <span>row content</span>
      </SortableListItem>
    );

    expect(screen.getByText('row content')).toBeInTheDocument();
  });
});
