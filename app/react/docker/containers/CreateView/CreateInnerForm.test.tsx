import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
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

import { CreateInnerForm } from './CreateInnerForm';
import { RestartPolicy } from './RestartPolicyTab/types';
import { Values } from './useInitialValues';

const onChangeName = vi.fn();
const onRateLimit = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/proxy/queries/useVersion', () => ({
  useApiVersion: () => 1.41,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarm: () => false,
  useIsStandalone: () => true,
  useSystemLimits: () => ({ maxCpu: 4, maxMemory: 8192 }),
  useIsWindows: () => false,
}));

vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));

vi.mock('./BaseForm', () => ({
  BaseForm: function MockBaseForm({
    onChangeName,
    onChangeImageName,
    onRateLimit,
  }: {
    onChangeName: (value: string) => void;
    onChangeImageName: () => void;
    onRateLimit: (limited?: boolean) => void;
  }) {
    return (
      <div>
        <button type="button" onClick={() => onChangeName('from-base')}>
          change-name
        </button>
        <button type="button" onClick={onChangeImageName}>
          change-image
        </button>
        <button type="button" onClick={() => onRateLimit(true)}>
          rate-limit
        </button>
      </div>
    );
  },
}));

vi.mock('./CommandsTab', () => ({
  CommandsTab: () => <div>commands-tab</div>,
}));

vi.mock('./VolumesTab', () => ({
  VolumesTab: () => <div>volumes-tab</div>,
}));

vi.mock('./NetworkTab', () => ({
  NetworkTab: () => <div>network-tab</div>,
}));

vi.mock('./EnvVarsTab', () => ({
  EnvVarsTab: () => <div>env-tab</div>,
}));

vi.mock('./LabelsTab', () => ({
  LabelsTab: () => <div>labels-tab</div>,
}));

vi.mock('./RestartPolicyTab', () => ({
  RestartPolicyTab: () => <div>restart-tab</div>,
}));

vi.mock('./ResourcesTab', () => ({
  ResourcesTab: ({
    renderLimits,
  }: {
    renderLimits?: (values: { cpu: number }) => ReactNode;
  }) => (
    <div>
      resources-tab
      {renderLimits?.({ cpu: 1, reservation: 0, limit: 0 } as never)}
    </div>
  ),
}));

vi.mock('./CapabilitiesTab', () => ({
  CapabilitiesTab: () => <div>capabilities-tab</div>,
}));

vi.mock('./ResourcesTab/EditResourceForm', () => ({
  EditResourcesForm: () => <div>edit-resources</div>,
}));

const values: Values = {
  name: 'web',
  enableWebhook: false,
  publishAllPorts: false,
  image: { image: 'nginx', registryId: 0, useRegistry: true },
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
    cmd: 'nginx',
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
  capabilities: ['CHOWN'],
  env: [],
};

describe('REQ-CTR-03 CreateInnerForm advanced settings tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
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

  it('renders base form callbacks and the default commands tab', async () => {
    const user = userEvent.setup();
    renderInnerForm();

    expect(await screen.findByText('Advanced container settings')).toBeVisible();
    expect(screen.getByText('commands-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'change-name' }));
    expect(onChangeName).toHaveBeenCalledWith('from-base');

    await user.click(screen.getByRole('button', { name: 'rate-limit' }));
    expect(onRateLimit).toHaveBeenCalledWith(true);
  });

  it('switches through local create tabs', async () => {
    const user = userEvent.setup();
    renderInnerForm();

    await user.click(await screen.findByRole('button', { name: 'Volumes' }));
    expect(await screen.findByText('volumes-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Network' }));
    expect(await screen.findByText('network-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Env' }));
    expect(await screen.findByText('env-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Labels' }));
    expect(await screen.findByText('labels-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restart policy' }));
    expect(await screen.findByText('restart-tab')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Runtime & resources' })
    );
    expect(await screen.findByText('resources-tab')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Capabilities' }));
    expect(await screen.findByText('capabilities-tab')).toBeVisible();
  });

  it('hides capabilities when requested and shows edit resources when duplicating', async () => {
    const user = userEvent.setup();
    renderInnerForm({ hideCapabilities: true, isDuplicate: true });

    expect(
      screen.queryByRole('button', { name: 'Capabilities' })
    ).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', { name: 'Runtime & resources' })
    );
    expect(await screen.findByText('edit-resources')).toBeVisible();
  });

  it('clears command and entrypoint when the image name changes', async () => {
    const user = userEvent.setup();
    let latest: Values | undefined;
    renderInnerForm({
      onValuesChange: (v) => {
        latest = v;
      },
    });

    await user.click(await screen.findByRole('button', { name: 'change-image' }));
    expect(latest?.commands.cmd).toBeNull();
    expect(latest?.commands.entrypoint).toBeNull();
  });
});

function renderInnerForm({
  hideCapabilities = false,
  isDuplicate = false,
  onValuesChange,
}: {
  hideCapabilities?: boolean;
  isDuplicate?: boolean;
  onValuesChange?: (values: Values) => void;
} = {}) {
  function Form() {
    return (
      <Formik
        initialValues={values}
        onSubmit={() => undefined}
      >
        {({ values: current }) => {
          onValuesChange?.(current);
          return (
            <CreateInnerForm
              hideCapabilities={hideCapabilities}
              isDuplicate={isDuplicate}
              isLoading={false}
              onChangeName={onChangeName}
              onRateLimit={onRateLimit}
            />
          );
        }}
      </Formik>
    );
  }

  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(Form, createMockUser({ Role: 1 })))
  );
  return render(<Wrapped />);
}
