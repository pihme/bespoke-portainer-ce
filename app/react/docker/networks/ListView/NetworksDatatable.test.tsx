import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { Role } from '@/portainer/users/types';
import { createMockUsers } from '@/react-tools/test-mocks';

import { NetworksDatatable } from './NetworksDatatable';
import { DecoratedNetwork } from './types';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('./useNetworksData', () => ({
  useNetworksData: () => ({
    data: [
      {
        Id: 'n1',
        Name: 'bridge',
        Driver: 'bridge',
        Scope: 'local',
        Attachable: false,
        StackName: '-',
        NodeName: '',
        Subs: [],
        IPAM: {
          Driver: 'default',
          IPV4Configs: [{ Subnet: '172.17.0.0/16', Gateway: '172.17.0.1' }],
          IPV6Configs: [],
        },
      } as unknown as DecoratedNetwork,
    ],
    isLoading: false,
  }),
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

describe('NetworksDatatable for local networks', () => {
  it('renders network rows and add/remove actions', () => {
    const onRemove = vi.fn();
    const user = createMockUsers(1, Role.Admin)[0];
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => <NetworksDatatable onRemove={onRemove} />),
        user
      )
    );
    render(<Wrapped />);
    expect(
      document.querySelector('[data-cy="network-link-bridge"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-cy="network-addNetworkButton"]')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Remove/i })
    ).toBeDisabled();
  });
});
