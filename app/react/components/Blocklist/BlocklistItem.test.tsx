import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BlocklistItem } from './BlocklistItem';

describe('BlocklistItem', () => {
  it('renders as a selected button list item by default', () => {
    render(<BlocklistItem isSelected>Item</BlocklistItem>);
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Item');
    expect(item).toHaveClass('blocklist-item--selected');
  });

  it('renders with a custom element type and className', () => {
    render(
      <BlocklistItem as="div" className="extra" isSelected={false}>
        Other
      </BlocklistItem>
    );
    const item = screen.getByRole('listitem');
    expect(item.tagName).toBe('DIV');
    expect(item).toHaveClass('extra');
    expect(item).not.toHaveClass('blocklist-item--selected');
  });
});
