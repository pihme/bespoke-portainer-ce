import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeaderContainer, useHeaderContext } from './HeaderContainer';

function Probe() {
  useHeaderContext();
  return <span>inside</span>;
}

describe('HeaderContainer', () => {
  it('provides header context to children', () => {
    render(
      <HeaderContainer id="hdr">
        <Probe />
      </HeaderContainer>
    );
    expect(screen.getByText('inside')).toBeVisible();
  });

  it('throws when useHeaderContext is used outside the container', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /Should be nested inside a HeaderContainer/
    );
    err.mockRestore();
  });
});
