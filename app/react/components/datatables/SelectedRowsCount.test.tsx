import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SelectedRowsCount } from './SelectedRowsCount';

describe('SelectedRowsCount (backwards compatibility)', () => {
  it('renders nothing when no rows are selected', () => {
    const { container } = render(<SelectedRowsCount value={0} hidden={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a singular item label without a hidden suffix', () => {
    render(<SelectedRowsCount value={1} hidden={0} />);
    expect(screen.getByText('1 item selected')).toBeInTheDocument();
  });

  it('appends the hidden-by-filters suffix when hidden is non-zero', () => {
    render(<SelectedRowsCount value={4} hidden={2} />);
    expect(
      screen.getByText('4 items selected (2 hidden by filters)')
    ).toBeInTheDocument();
  });
});
