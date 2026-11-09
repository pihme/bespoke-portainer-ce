import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { ContainerEngine } from '@/react/portainer/environments/types';
import {
  createMockEnvironment,
  createMockUser,
} from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { server } from '@/setup-tests/server';

import { ResourcesTab, Values } from './ResourcesTab';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsStandalone: () => true,
  useSystemLimits: () => ({ maxCpu: 4, maxMemory: 8192 }),
}));

vi.mock('./GpuFieldset', () => ({
  GpuFieldset: () => <div>gpu-fieldset</div>,
}));

vi.mock('./RuntimeSection', () => ({
  RuntimeSection: () => <div>runtime-section</div>,
}));

vi.mock('./DevicesField', () => ({
  DevicesField: () => <div>devices-field</div>,
}));

vi.mock('./SysctlsField', () => ({
  SysctlsField: () => <div>sysctls-field</div>,
}));

vi.mock('./SecurityOptField', () => ({
  SecurityOptField: () => <div>security-opt-field</div>,
}));

vi.mock('./ResourcesFieldset', () => ({
  ResourceFieldset: ({
    onChange,
  }: {
    onChange: (values: {
      cpu: number;
      reservation: number;
      limit: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ cpu: 2, reservation: 0, limit: 0 })}
    >
      set-resources
    </button>
  ),
}));

const values: Values = {
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
};

describe('REQ-CTR-03 ResourcesTab', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            ContainerEngine: ContainerEngine.Docker,
            EnableGPUManagement: false,
            Gpus: [],
          })
        )
      )
    );
  });

  it('renders runtime fields and updates shared memory / resources', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();

    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(
          () => (
            <ResourcesTab
              values={values}
              setFieldValue={setFieldValue}
              allowPrivilegedMode
              isInitFieldVisible
              isDevicesFieldVisible
              isSysctlFieldVisible
              isSecurityOptFieldVisible
            />
          ),
          createMockUser({ Role: 1 })
        )
      )
    );
    render(<Wrapped />);

    expect(await screen.findByText('runtime-section')).toBeVisible();
    expect(screen.getByText('devices-field')).toBeVisible();
    expect(screen.getByText('sysctls-field')).toBeVisible();
    expect(screen.getByText('security-opt-field')).toBeVisible();
    expect(screen.getByText('gpu-fieldset')).toBeVisible();

    await user.clear(screen.getByTestId('shared-memory-size'));
    await user.type(screen.getByTestId('shared-memory-size'), '128');
    expect(setFieldValue).toHaveBeenCalledWith(
      'sharedMemorySize',
      expect.any(Number)
    );

    await user.click(screen.getByRole('button', { name: 'set-resources' }));
    expect(setFieldValue).toHaveBeenCalledWith('resources', {
      cpu: 2,
      reservation: 0,
      limit: 0,
    });
  });

  it('uses renderLimits instead of the default resource fieldset', async () => {
    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(
          () => (
            <ResourcesTab
              values={values}
              setFieldValue={vi.fn()}
              allowPrivilegedMode={false}
              isInitFieldVisible={false}
              isDevicesFieldVisible={false}
              isSysctlFieldVisible={false}
              isSecurityOptFieldVisible={false}
              renderLimits={() => <div>custom-limits</div>}
            />
          ),
          createMockUser({ Role: 1 })
        )
      )
    );
    render(<Wrapped />);

    expect(await screen.findByText('custom-limits')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'set-resources' })
    ).not.toBeInTheDocument();
  });
});
