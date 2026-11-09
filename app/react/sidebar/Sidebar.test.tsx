import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { Sidebar } from './Sidebar';

let isPureAdmin = true;
let isAdmin = true;
let isAdminLoading = false;
let settingsData: { LogoURL?: string } | undefined = { LogoURL: '' };

vi.mock('@/react/hooks/useUser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useIsPureAdmin: () => isPureAdmin,
    useIsEdgeAdmin: () => ({ isAdmin, isLoading: isAdminLoading }),
  };
});

vi.mock('@/react/portainer/settings/queries', () => ({
  usePublicSettings: () => ({
    data: settingsData,
    isLoading: !settingsData,
  }),
}));

vi.mock('./EnvironmentSidebar', () => ({
  EnvironmentSidebar: () => <div data-cy="stub-env-sidebar">Env</div>,
}));

vi.mock('./AppDeliverySidebar', () => ({
  AppDeliverySidebar: () => <div data-cy="stub-app-delivery">AppDelivery</div>,
}));


vi.mock('./SettingsSidebar', () => ({
  SettingsSidebar: ({
    isPureAdmin: pure,
    isAdmin: admin,
    ...rest
  }: {
    isPureAdmin: boolean;
    isAdmin: boolean;
  }) => (
    <div data-cy="stub-settings">
      Settings pure={String(pure)} admin={String(admin)} props=
      {Object.keys(rest).join(',')}
    </div>
  ),
}));

vi.mock('./Footer', () => ({
  Footer: () => <div data-cy="stub-footer">Footer</div>,
}));

vi.mock('./UpgradeBEBanner', () => ({
  UpgradeBEBannerWrapper: () => <div data-cy="stub-upgrade">Upgrade</div>,
}));

vi.mock('./Header', () => ({
  Header: ({ logo }: { logo?: string }) => (
    <div data-cy="stub-header">Header {logo || 'default'}</div>
  ),
}));

function renderSidebar() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(Sidebar), createMockUser({ Role: 1 }))
  );
  return render(<Wrapped />);
}

describe('Sidebar shell', () => {
  beforeEach(() => {
    isPureAdmin = true;
    isAdmin = true;
    isAdminLoading = false;
    settingsData = { LogoURL: 'https://example.com/logo.png' };
    window.ddExtension = false;
  });

  it('renders null while settings or admin query are loading', () => {
    settingsData = undefined;
    const { container } = renderSidebar();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders null while admin query is loading', () => {
    isAdminLoading = true;
    const { container } = renderSidebar();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders home link environment app delivery settings and footer for local Docker', () => {
    renderSidebar();

    expect(screen.getByTestId('portainerSidebar-home')).toBeInTheDocument();
    expect(screen.getByTestId('stub-env-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('stub-app-delivery')).toBeInTheDocument();
    expect(screen.getByTestId('stub-settings')).toHaveTextContent(
      'pure=true admin=true'
    );
    expect(screen.getByTestId('stub-footer')).toBeInTheDocument();
    expect(screen.getByTestId('stub-header')).toHaveTextContent(
      'https://example.com/logo.png'
    );
    expect(screen.getByTestId('stub-upgrade')).toBeInTheDocument();
  });

  it('REQ-TAI-004 renders no Edge compute section, even for admins', () => {
    isAdmin = true;
    renderSidebar();
    expect(screen.queryByText(/Edge compute/i)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('portainerSidebar-edgeGroups')
    ).not.toBeInTheDocument();
  });

  it('REQ-TAI-001 passes no team leader flag into SettingsSidebar', () => {
    renderSidebar();
    expect(screen.getByTestId('stub-settings')).not.toHaveTextContent(
      'isTeamLeader'
    );
  });
});
