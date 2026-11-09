import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@uirouter/react-hybrid', () => ({
  UIRouterContextComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="ui-router-context">{children}</div>
  ),
}));

import { withUIRouter } from './withUIRouter';

function Child({ text }: { text: string }) {
  return <span>{text}</span>;
}

describe('withUIRouter', () => {
  it('wraps the component in UIRouterContextComponent and sets displayName', () => {
    const Wrapped = withUIRouter(Child);
    expect(Wrapped.displayName).toBe('withUIRouter(Child)');
    render(<Wrapped text="routed" />);
    expect(screen.getByTestId('ui-router-context')).toBeInTheDocument();
    expect(screen.getByText('routed')).toBeInTheDocument();
  });

  it('falls back to Component for anonymous wrappers', () => {
    const Anonymous = (() => <span>y</span>) as React.ComponentType;
    Object.defineProperty(Anonymous, 'name', { value: '' });
    expect(withUIRouter(Anonymous).displayName).toBe(
      'withUIRouter(Component)'
    );
  });
});
