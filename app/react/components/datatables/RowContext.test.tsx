import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRowContext } from './RowContext';

type Ctx = { endpointId: number };

const { RowProvider, useRowContext } = createRowContext<Ctx>();

function Reader() {
  const ctx = useRowContext();
  return <span data-cy="row-ctx">{ctx.endpointId}</span>;
}

describe('createRowContext (backwards compatibility)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('throws when used outside RowProvider', () => {
    expect(() => render(<Reader />)).toThrow(
      /should be nested under RowProvider/
    );
  });

  it('exposes the provided row context to consumers', () => {
    render(
      <RowProvider context={{ endpointId: 7 }}>
        <Reader />
      </RowProvider>
    );

    expect(screen.getByTestId('row-ctx')).toHaveTextContent('7');
  });
});
