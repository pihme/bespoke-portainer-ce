import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { server } from '@/setup-tests/server';

import { SettingsView } from './SettingsView';

const updateLogo = vi.fn();
const updateSnapshotInterval = vi.fn();
const invoke = vi.fn((fn: (stateManager: { updateLogo: typeof updateLogo; updateSnapshotInterval: typeof updateSnapshotInterval }) => void) => {
  fn({ updateLogo, updateSnapshotInterval });
});

vi.mock('angular', () => ({
  default: {
    element: () => ({
      injector: () => ({ invoke }),
    }),
  },
}));

vi.mock('./ApplicationSettingsPanel', () => ({
  ApplicationSettingsPanel: ({
    onSuccess,
    settings,
  }: {
    onSuccess: (s: { LogoURL: string; SnapshotInterval: string }) => void;
    settings: { LogoURL: string; SnapshotInterval: string };
  }) => (
    <button
      type="button"
      onClick={() =>
        onSuccess({
          LogoURL: settings.LogoURL || 'https://logo',
          SnapshotInterval: '10m',
        })
      }
    >
      sync-settings
    </button>
  ),
}));


vi.mock('./HiddenContainersPanel/HiddenContainersPanel', () => ({
  HiddenContainersPanel: () => <div>hidden-containers</div>,
}));

vi.mock('./SSLSettingsPanel/SSLSettingsPanel', () => ({
  SSLSettingsPanelWrapper: () => <div>ssl-settings</div>,
}));

vi.mock('./ExperimentalFeatures', () => ({
  ExperimentalFeatures: () => <div>Experimental features</div>,
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe('REQ-SET-01 SettingsView parent chrome', () => {
  function setupMocks() {
    server.use(
      http.get('/api/settings', () =>
        HttpResponse.json({
          LogoURL: 'https://logo.example/logo.png',
          SnapshotInterval: '5m',
        })
      ),
      http.get('/api/settings/public', () =>
        HttpResponse.json({ Features: {} })
      )
    );
  }

  function renderComponent() {
    const Wrapped = withTestQueryProvider(
      withUserProvider(withTestRouter(SettingsView))
    );
    return render(<Wrapped />);
  }

  it('should NOT render ExperimentalFeatures component in CE edition', async () => {
    setupMocks();
    renderComponent();
    await waitFor(() => expect(screen.getByText('Settings')).toBeVisible());
    expect(screen.queryByText('Experimental features')).not.toBeInTheDocument();
  });

  it('renders local settings chrome and syncs StateManager on success', async () => {
    setupMocks();
    renderComponent();
    await waitFor(() => expect(screen.getByText('sync-settings')).toBeVisible());
    expect(screen.getByText('ssl-settings')).toBeVisible();
    expect(screen.getByText('hidden-containers')).toBeVisible();

    screen.getByText('sync-settings').click();
    expect(invoke).toHaveBeenCalled();
    expect(updateLogo).toHaveBeenCalledWith('https://logo.example/logo.png');
    expect(updateSnapshotInterval).toHaveBeenCalledWith('10m');
  });

  it('scrolls to a hash target when settings load', async () => {
    setupMocks();
    const target = document.createElement('div');
    target.id = 'ssl';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    window.location.hash = '#!/settings#ssl';

    renderComponent();
    await waitFor(() => expect(target.scrollIntoView).toHaveBeenCalled());
    document.body.removeChild(target);
  });

  it('REQ-TAI-006 shows no backup panel', async () => {
    setupMocks();
    renderComponent();
    await waitFor(() => expect(screen.getByText('sync-settings')).toBeVisible());
    expect(screen.queryByText(/back up portainer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backup/i)).not.toBeInTheDocument();
  });

  it('REQ-TAI-002 shows no Kubernetes or Helm settings', async () => {
    setupMocks();
    renderComponent();
    await waitFor(() => expect(screen.getByText('sync-settings')).toBeVisible());
    expect(screen.queryByText(/kubernetes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/kubeconfig/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/helm/i)).not.toBeInTheDocument();
  });
});
