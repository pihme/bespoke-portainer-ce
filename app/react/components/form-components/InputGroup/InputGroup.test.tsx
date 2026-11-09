import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InputGroup } from './index';
import { useInputGroupContext } from './InputGroup';

describe('InputGroup', () => {
  it('renders children with size classes', () => {
    const { container, rerender } = render(
      <InputGroup size="large" className="extra">
        <InputGroup.Addon>prefix</InputGroup.Addon>
        <InputGroup.Input data-cy="ig-input" />
        <InputGroup.ButtonWrapper>
          <button type="button">Go</button>
        </InputGroup.ButtonWrapper>
      </InputGroup>
    );
    expect(container.querySelector('.input-group-lg')).toBeTruthy();
    expect(container.querySelector('.extra')).toBeTruthy();
    expect(screen.getByText('prefix')).toHaveClass('input-group-addon');
    expect(screen.getByRole('button', { name: 'Go' })).toBeVisible();

    rerender(
      <InputGroup size="small">
        <InputGroup.Addon required>req</InputGroup.Addon>
      </InputGroup>
    );
    expect(container.querySelector('.input-group-sm')).toBeTruthy();
    expect(screen.getByText('req')).toHaveClass('required');
  });

  it('uses no size class when size is omitted', () => {
    const { container } = render(
      <InputGroup>
        <InputGroup.Addon>x</InputGroup.Addon>
      </InputGroup>
    );
    expect(container.querySelector('.input-group-lg')).toBeNull();
    expect(container.querySelector('.input-group-sm')).toBeNull();
    expect(container.querySelector('.input-group')).toBeTruthy();
  });

  it('throws when Addon is used outside InputGroup', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<InputGroup.Addon>x</InputGroup.Addon>)).toThrow(
      /Should be inside a InputGroup/
    );
    spy.mockRestore();
  });

  it('throws when context hook is used outside', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useInputGroupContext();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(/Should be inside a InputGroup/);
    spy.mockRestore();
  });
});
