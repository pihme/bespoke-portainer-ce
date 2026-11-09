import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { withI18nSuspense } from './withI18nSuspense';

function Hello({ name }: { name: string }) {
  return <div>Hello {name}</div>;
}

describe('withI18nSuspense', () => {
  it('renders the wrapped component inside Suspense and sets displayName', () => {
    const Wrapped = withI18nSuspense(Hello);
    expect(Wrapped.displayName).toBe('withI18nSuspense(Hello)');
    render(<Wrapped name="Portainer" />);
    expect(screen.getByText('Hello Portainer')).toBeInTheDocument();
  });

  it('falls back to Component for anonymous wrappers', () => {
    const Anonymous = (() => <span>x</span>) as React.ComponentType;
    Object.defineProperty(Anonymous, 'name', { value: '' });
    expect(withI18nSuspense(Anonymous).displayName).toBe(
      'withI18nSuspense(Component)'
    );
  });
});
