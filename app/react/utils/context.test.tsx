import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { createContext } from './context';

const { Provider, useContext } = createContext<{ label: string }>('DemoCtx');

function Reader() {
  const ctx = useContext();
  return <span>{ctx.label}</span>;
}

describe('createContext', () => {
  it('provides context values to consumers', () => {
    render(
      <Provider context={{ label: 'hello' }}>
        <Reader />
      </Provider>
    );
    expect(screen.getByText('hello')).toBeVisible();
  });

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Reader />)).toThrow(
      'should be nested under Provider - DemoCtx'
    );
    spy.mockRestore();
  });
});
