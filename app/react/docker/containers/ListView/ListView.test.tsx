import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { Environment } from '@/react/portainer/environments/types';

import { ListView } from './ListView';

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('./ContainersDatatable', () => ({
  ContainersDatatable: (props: { environment: Environment }) => (
    <div data-cy="containers-table">
      props:{Object.keys(props).sort().join(',')};env:{props.environment.Id}
    </div>
  ),
}));

function env(overrides: Partial<Environment> = {}): Environment {
  return {
    Id: 9,
    Type: 1,
    Name: 'local',
    ...overrides,
  } as Environment;
}

describe('containers ListView parent', () => {
  it('renders the container list for the environment', () => {
    render(<ListView endpoint={env({ Type: 1 })} />);
    expect(screen.getByText('Container list')).toBeVisible();
    expect(screen.getByTestId('containers-table')).toHaveTextContent(
      'props:environment;env:9'
    );
  });

  // REQ-TAI-007: per-node targeting is removed; even a legacy Agent environment
  // gets no host column switch.
  it('REQ-TAI-007 passes no host column flag, even for a legacy agent environment', () => {
    render(<ListView endpoint={env({ Type: 2 })} />);
    expect(screen.getByTestId('containers-table')).toHaveTextContent(
      'props:environment;env:9'
    );
  });
});
