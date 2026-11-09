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

import { VolumesTab } from './VolumesTab';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('./VolumeSelector', () => ({
  VolumeSelector: ({
    onChange,
  }: {
    onChange: (value: string | undefined) => void;
  }) => (
    <button type="button" onClick={() => onChange('data')}>
      pick-volume
    </button>
  ),
}));

describe('REQ-CTR-09 VolumesTab create-form mapping', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            ContainerEngine: ContainerEngine.Docker,
            SecuritySettings: {
              allowBindMountsForRegularUsers: true,
              allowPrivilegedModeForRegularUsers: true,
              allowContainerCapabilitiesForRegularUsers: true,
              allowDeviceMappingForRegularUsers: true,
              allowHostNamespaceForRegularUsers: true,
              allowStackManagementForRegularUsers: true,
              allowSysctlSettingForRegularUsers: true,
              allowSecurityOptForRegularUsers: true,
              allowVolumeBrowserForRegularUsers: true,
              enableHostManagementFeatures: false,
            },
          })
        )
      )
    );
  });

  it('adds a volume mapping row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(
          () => <VolumesTab values={[]} onChange={onChange} />,
          createMockUser({ Role: 1 })
        )
      )
    );
    render(<Wrapped />);

    await user.click(
      await screen.findByRole('button', { name: /map additional volume/i })
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        containerPath: '',
        type: 'volume',
        name: '',
        readOnly: false,
      },
    ]);
  });
});
