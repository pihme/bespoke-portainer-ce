import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const go = vi.fn();

vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));

import { Redirect } from './Redirect';

describe('Redirect', () => {
  it('navigates to the target state on mount', () => {
    render(<Redirect to="docker.dashboard" params={{ id: 1 }} />);
    expect(go).toHaveBeenCalledWith('docker.dashboard', { id: 1 });
  });

  it('uses an empty params object by default', () => {
    go.mockClear();
    render(<Redirect to="home" />);
    expect(go).toHaveBeenCalledWith('home', {});
  });
});
