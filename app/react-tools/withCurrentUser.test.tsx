import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';

vi.mock('@/react/hooks/useUser', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="user-provider">{children}</div>
  ),
}));

import { withCurrentUser } from './withCurrentUser';

function Child({ label }: { label: string }) {
  const client = useQueryClient();
  return (
    <div>
      <span>{label}</span>
      <span data-cy="has-client">{String(Boolean(client))}</span>
    </div>
  );
}

describe('withCurrentUser', () => {
  it('wraps with UserProvider and React Query and sets displayName', () => {
    const Wrapped = withCurrentUser(Child);
    expect(Wrapped.displayName).toBe('withReactQuery(withCurrentUser(Child))');
    render(<Wrapped label="me" />);
    expect(screen.getByTestId('user-provider')).toBeInTheDocument();
    expect(screen.getByText('me')).toBeInTheDocument();
    expect(screen.getByTestId('has-client')).toHaveTextContent('true');
  });

  it('falls back to Component for anonymous wrappers', () => {
    const Anonymous = (() => <span>z</span>) as React.ComponentType;
    Object.defineProperty(Anonymous, 'name', { value: '' });
    expect(withCurrentUser(Anonymous).displayName).toBe(
      'withReactQuery(withCurrentUser(Component))'
    );
  });
});
