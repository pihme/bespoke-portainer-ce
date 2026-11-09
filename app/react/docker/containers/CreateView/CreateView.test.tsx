import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormikContext } from 'formik';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';
import { ContainerEngine } from '@/react/portainer/environments/types';
import {
  createMockEnvironment,
  createMockUser,
} from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { server } from '@/setup-tests/server';

import { CreateView } from './CreateView';
import { RestartPolicy } from './RestartPolicyTab/types';
import { Values } from './useInitialValues';

const mockMutate = vi.fn();
const mockGo = vi.fn();
const mockConfirmDestructive = vi.fn();
const mockNotifySuccess = vi.fn();

const initialValues: Values = {
  name: 'web',
  enableWebhook: false,
  publishAllPorts: false,
  image: { image: 'nginx', registryId: 2, useRegistry: true },
  alwaysPull: true,
  ports: [],
  accessControl: {
    ownership: ResourceControlOwnership.ADMINISTRATORS,
    authorizedUsers: [],
    authorizedTeams: [],
  },
  nodeName: '',
  autoRemove: false,
  commands: {
    cmd: null,
    entrypoint: null,
    user: '',
    workingDir: '',
    console: 'none',
    logConfig: { type: '', options: [] },
  },
  volumes: [],
  network: {
    networkMode: 'bridge',
    hostname: '',
    domain: '',
    macAddress: '',
    ipv4Address: '',
    ipv6Address: '',
    primaryDns: '',
    secondaryDns: '',
    hostsFileEntries: [],
    container: '',
  },
  labels: [],
  restartPolicy: RestartPolicy.No,
  resources: {
    runtime: { privileged: false, init: false, type: '' },
    devices: [],
    sysctls: [],
    securityOpt: [],
    sharedMemorySize: 64,
    gpu: {
      enabled: false,
      useSpecific: false,
      selectedGPUs: ['all'],
      capabilities: ['compute', 'utility'],
    },
    resources: { reservation: 0, limit: 0, cpu: 0 },
  },
  capabilities: [],
  env: [],
};

const initialValuesState: {
  initialValues: Values;
  isDuplicating?: boolean;
  extraNetworks?: Array<{ networkName: string; aliases: string[] }>;
} = {
  initialValues,
  isDuplicating: false,
  extraNetworks: [],
};

let containersForName: Array<{ Id: string; Names: string[]; IsPortainer?: boolean }> =
  [];

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useRouter: () => ({ stateService: { go: mockGo } }),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsWindows: () => false,
  useSystemLimits: () => ({ maxCpu: 4, maxMemory: 8192 }),
  useIsSwarm: () => false,
  useIsStandalone: () => true,
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useIsEdgeAdmin: () => ({ isAdmin: true }),
    useIsEnvironmentAdmin: () => ({ authorized: true }),
  };
});

vi.mock('@/react/portainer/environments/queries/useEnvironmentRegistries', () => ({
  useEnvironmentRegistries: () => ({
    data: [{ Id: 2, Name: 'dockerhub', URL: 'docker.io' }],
  }),
}));

vi.mock('./useCreateMutation', () => ({
  useCreateOrReplaceMutation: () => ({
    isLoading: false,
    isSuccess: false,
    mutate: mockMutate,
  }),
}));

vi.mock('./useInitialValues', async (importOriginal: () => Promise<object>) => {
  const actual =
    await importOriginal<typeof import('./useInitialValues')>();
  return {
    ...actual,
    useInitialValues: () => initialValuesState,
  };
});

vi.mock('../queries/useContainers', () => ({
  useContainers: () => ({ data: containersForName }),
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDestructive: (...args: unknown[]) => mockConfirmDestructive(...args),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args),
  notifyError: vi.fn(),
}));

vi.mock('./CreateInnerForm', () => ({
  CreateInnerForm: function MockCreateInnerForm({
    onChangeName,
    onRateLimit,
  }: {
    onChangeName: (value: string) => void;
    onRateLimit: (limited?: boolean) => void;
  }) {
    const { submitForm } = useFormikContext();
    return (
      <div>
        <button type="button" onClick={() => onChangeName('web')}>
          sync-name
        </button>
        <button type="button" onClick={() => onRateLimit(true)}>
          hit-rate-limit
        </button>
        <button type="button" onClick={() => submitForm()}>
          submit-create
        </button>
      </div>
    );
  },
}));

describe('REQ-CTR-03 CreateView local Docker create page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containersForName = [];
    initialValuesState.isDuplicating = false;
    initialValuesState.extraNetworks = [];
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            Type: 1,
            ContainerEngine: ContainerEngine.Docker,
            SecuritySettings: {
              allowContainerCapabilitiesForRegularUsers: true,
              allowBindMountsForRegularUsers: true,
              allowDeviceMappingForRegularUsers: true,
              allowSysctlSettingForRegularUsers: true,
              allowHostNamespaceForRegularUsers: true,
              allowPrivilegedModeForRegularUsers: true,
              allowVolumeBrowserForRegularUsers: true,
              allowStackManagementForRegularUsers: true,
              allowSecurityOptForRegularUsers: true,
              enableHostManagementFeatures: false,
            },
          })
        )
      )
    );
  });

  it('renders the create container page header', async () => {
    renderCreateView();

    expect(
      await screen.findByRole('heading', { name: 'Create container', level: 1 })
    ).toBeVisible();
    expect(screen.getByText('Add container')).toBeVisible();
  });

  it('submits a create mutation with the selected registry', async () => {
    const user = userEvent.setup();
    renderCreateView();

    await user.click(
      await screen.findByRole('button', { name: 'submit-create' })
    );

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    const [payload, options] = mockMutate.mock.calls[0];
    expect(payload.config.Image).toContain('nginx');
    expect(payload.registry).toEqual(
      expect.objectContaining({ Id: 2, Name: 'dockerhub' })
    );
    expect(payload.values.name).toBe('web');

    options.onSuccess();
    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'Success',
      'Container successfully created'
    );
    expect(mockGo).toHaveBeenCalledWith('docker.containers');
  });

  it('asks before replacing an existing container and aborts when cancelled', async () => {
    const user = userEvent.setup();
    mockConfirmDestructive.mockResolvedValueOnce(false);
    containersForName = [
      { Id: 'c1', Names: ['/web'], IsPortainer: false },
    ];

    renderCreateView();
    await user.click(await screen.findByRole('button', { name: 'sync-name' }));
    await user.click(screen.getByRole('button', { name: 'submit-create' }));

    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('replaces an existing container when the user confirms', async () => {
    const user = userEvent.setup();
    mockConfirmDestructive.mockResolvedValueOnce(true);
    containersForName = [
      { Id: 'c1', Names: ['/web'], IsPortainer: false },
    ];

    renderCreateView();
    await user.click(await screen.findByRole('button', { name: 'sync-name' }));
    await user.click(screen.getByRole('button', { name: 'submit-create' }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(mockMutate.mock.calls[0][0].oldContainer).toEqual(
      expect.objectContaining({ Id: 'c1' })
    );
  });
});

describe('REQ-CTR-06 CreateView duplicate caution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    containersForName = [];
    initialValuesState.isDuplicating = true;
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            ContainerEngine: ContainerEngine.Docker,
          })
        )
      )
    );
  });

  it('shows the duplication caution panel', async () => {
    renderCreateView();

    expect(
      await screen.findByText(/new container may fail to start/i)
    ).toBeVisible();
    expect(screen.getByText(/settings from the previous container/i)).toBeVisible();
  });
});

function renderCreateView() {
  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(CreateView, createMockUser({ Role: 1 })))
  );
  return render(<Wrapped />);
}
