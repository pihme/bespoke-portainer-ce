import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';

import { withReactQuery } from './withReactQuery';
import { createQueryClient } from './react-query';

function Probe({ label }: { label: string }) {
  const client = useQueryClient();
  return (
    <div>
      <span>{label}</span>
      <span data-cy="has-client">{String(Boolean(client))}</span>
    </div>
  );
}

describe('withReactQuery', () => {
  it('wraps a component with QueryClientProvider and sets displayName', () => {
    const Wrapped = withReactQuery(Probe);
    expect(Wrapped.displayName).toBe('withReactQuery(Probe)');

    render(<Wrapped label="hello" />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByTestId('has-client')).toHaveTextContent('true');
  });

  it('falls back to Component when the wrapped component has no name', () => {
    const Anonymous = (() => <div>anon</div>) as React.ComponentType;
    Object.defineProperty(Anonymous, 'name', { value: '' });
    const Wrapped = withReactQuery(Anonymous);
    expect(Wrapped.displayName).toBe('withReactQuery(Component)');
  });

  it('uses a provided query client instance', () => {
    const custom = createQueryClient();
    let seen: unknown;
    function Catcher() {
      seen = useQueryClient();
      return <div>ok</div>;
    }
    const Wrapped = withReactQuery(Catcher, custom);
    render(<Wrapped />);
    expect(seen).toBe(custom);
  });
});
