import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { BuildInfoModalButton } from './BuildInfoModal';

const statusData = {
  Version: '2.27.0',
  Edition: 'Community Edition',
};

const versionData = {
  VersionSupport: 'LTS' as const,
  ServerVersion: '2.27.0',
  DatabaseVersion: '2.27.0',
  UpdateAvailable: false,
  LatestVersion: '',
  Build: {
    BuildNumber: '100',
    ImageTag: 'latest',
    NodejsVersion: '20.0.0',
    PnpmVersion: '9.0.0',
    WebpackVersion: '5.0.0',
    GoVersion: '1.22',
    GitCommit: 'abc123',
  },
  Dependencies: {
    DockerVersion: '24.0',
    HelmVersion: '3.0',
    KubectlVersion: '1.28',
    ComposeVersion: '2.20',
  },
  Runtime: {
    Env: ['FOO=bar', 'BAZ=qux'],
  },
};

let isAdmin = true;
let status: typeof statusData | undefined = statusData;
let version: typeof versionData | undefined = versionData;

vi.mock('@/react/portainer/system/useSystemStatus', () => ({
  useSystemStatus: () => ({ data: status }),
}));

vi.mock('@/react/portainer/system/useSystemVersion', () => ({
  useSystemVersion: () => ({ data: version }),
}));

vi.mock('@/react/hooks/useUser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useIsEdgeAdmin: () => ({ isAdmin }),
  };
});

function renderButton() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(BuildInfoModalButton, createMockUser({ Role: 1 }))
  );
  return render(<Wrapped />);
}

describe('REQ-ENV-02 BuildInfoModal', () => {
  beforeEach(() => {
    isAdmin = true;
    status = statusData;
    version = versionData;
  });

  it('renders nothing while status or version are loading', () => {
    status = undefined;
    const { container } = renderButton();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows version support on the button and opens the modal with build details', () => {
    renderButton();

    const button = screen.getByTestId('portainerSidebar-versionNumber');
    expect(button).toHaveTextContent('2.27.0 LTS');

    fireEvent.click(button);

    expect(screen.getByLabelText('build-info-modal')).toBeInTheDocument();
    expect(screen.getByText(/Server Version: 2.27.0 LTS/)).toBeInTheDocument();
    expect(screen.getByText(/Database Version: 2.27.0/)).toBeInTheDocument();
    expect(screen.getByText(/CI Build Number: 100/)).toBeInTheDocument();
    expect(screen.getByText(/Image Tag: latest/)).toBeInTheDocument();
    expect(screen.getByText(/Git Commit: abc123/)).toBeInTheDocument();
    expect(screen.getByText(/Nodejs 20.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/Docker 24.0/)).toBeInTheDocument();
    expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    expect(screen.getByText('FOO=bar')).toBeInTheDocument();
  });

  it('hides environment variables for non-admin users', () => {
    isAdmin = false;
    renderButton();
    fireEvent.click(screen.getByTestId('portainerSidebar-versionNumber'));
    expect(screen.queryByText('Environment Variables')).not.toBeInTheDocument();
  });

  it('closes the modal when Ok is clicked', () => {
    renderButton();
    fireEvent.click(screen.getByTestId('portainerSidebar-versionNumber'));
    fireEvent.click(screen.getByTestId('portainerBuildInfoModal-CloseButton'));
    expect(screen.queryByLabelText('build-info-modal')).not.toBeInTheDocument();
  });
});
