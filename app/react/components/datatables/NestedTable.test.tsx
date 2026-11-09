import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NestedTable } from './NestedTable';

describe('NestedTable (backwards compatibility)', () => {
  it('wraps children in the inner-datatable container', () => {
    const { container } = render(
      <NestedTable>
        <span>inside</span>
      </NestedTable>
    );

    expect(container.firstChild).toHaveClass('inner-datatable');
    expect(screen.getByText('inside')).toBeInTheDocument();
  });
});
