import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { withTestRouter } from './withRouter';

function Probe() {
  return <div>routed</div>;
}

describe('withTestRouter', () => {
  it('wraps a component with UIRouter and sets displayName', () => {
    const Wrapped = withTestRouter(Probe, {
      route: 'home',
      stateConfig: [{ name: 'home', url: '/' }],
    });
    expect(Wrapped.displayName).toBe('withTestRouter(Probe)');
    render(<Wrapped />);
    expect(screen.getByText('routed')).toBeInTheDocument();
  });

  it('uses defaults for anonymous components', () => {
    const Anonymous = () => <div>anon</div>;
    const Wrapped = withTestRouter(Anonymous);
    expect(Wrapped.displayName).toBe('withTestRouter(Anonymous)');
    render(<Wrapped />);
    expect(screen.getByText('anon')).toBeInTheDocument();
  });
});
