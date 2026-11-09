import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCurrentUser } from '@/react/hooks/useUser';
import { User } from '@/portainer/users/types';

import { withUserProvider } from './withUserProvider';

function Probe() {
  const { user } = useCurrentUser();
  return <div>{user.Username}</div>;
}

describe('withUserProvider', () => {
  it('wraps with the default mock user', () => {
    const Wrapped = withUserProvider(Probe);
    expect(Wrapped.displayName).toBe('withUserProvider(Probe)');
    render(<Wrapped />);
    expect(screen.getByText('mock')).toBeInTheDocument();
  });

  it('accepts a custom user and anonymous components', () => {
    const custom: User = {
      EndpointAuthorizations: [],
      Id: 9,
      Role: 1,
      Username: 'admin',
      UseCache: false,
      ThemeSettings: { color: 'dark' },
    };
    const Anonymous = () => {
      const { user } = useCurrentUser();
      return <div>{user.Username}</div>;
    };
    const Wrapped = withUserProvider(Anonymous, custom);
    expect(Wrapped.displayName).toBe('withUserProvider(Anonymous)');
    render(<Wrapped />);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
