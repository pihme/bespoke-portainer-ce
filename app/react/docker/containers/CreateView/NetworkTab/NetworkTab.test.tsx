import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';

import { NetworkTab } from './NetworkTab';
import { Values } from './types';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));

vi.mock('../../components/NetworkSelector', () => ({
  NetworkSelector: ({
    value,
    onChange,
    additionalOptions,
  }: {
    value: string;
    onChange: (value: string) => void;
    additionalOptions?: Array<{ label: string; value: string }>;
  }) => (
    <div>
      <div data-cy="extra-options">
        {(additionalOptions || []).map((o) => o.value).join(',')}
      </div>
      <button type="button" onClick={() => onChange('container')}>
        select-container-mode
      </button>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('./ContainerSelector', () => ({
  ContainerSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onChange('other')}>
      pick-container-{value || 'empty'}
    </button>
  ),
}));

vi.mock('./HostsFileEntries', () => ({
  HostsFileEntries: ({
    onChange,
  }: {
    onChange: (values: string[]) => void;
  }) => (
    <button type="button" onClick={() => onChange(['host.docker.internal:host-gateway'])}>
      set-hosts
    </button>
  ),
}));

describe('REQ-CTR-03 NetworkTab local Docker create fields', () => {
  it('renders network fields and container mode extras for Docker', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    const values: Values = {
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
    };

    renderTab(values, setFieldValue);

    expect(screen.getByTestId('extra-options')).toHaveTextContent('container');

    await user.type(
      screen.getByPlaceholderText('e.g. web01'),
      'web01'
    );
    expect(setFieldValue).toHaveBeenCalledWith('hostname', expect.any(String));

    await user.type(
      screen.getByTestId('docker-container-domain-input'),
      'example.com'
    );
    expect(setFieldValue).toHaveBeenCalledWith('domain', expect.any(String));

    await user.click(screen.getByRole('button', { name: 'select-container-mode' }));
    expect(setFieldValue).toHaveBeenCalledWith('networkMode', 'container');
  });

  it('shows the container selector in container network mode', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    renderTab(
      {
        networkMode: 'container',
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
      setFieldValue
    );

    await user.click(
      screen.getByRole('button', { name: 'pick-container-empty' })
    );
    expect(setFieldValue).toHaveBeenCalledWith('container', 'other');

    await user.click(screen.getByRole('button', { name: 'set-hosts' }));
    expect(setFieldValue).toHaveBeenCalledWith('hostsFileEntries', [
      'host.docker.internal:host-gateway',
    ]);
  });
});

function renderTab(values: Values, setFieldValue: (f: string, v: unknown) => void) {
  const Wrapped = withTestQueryProvider(
    withUserProvider(
      () => (
        <NetworkTab values={values} setFieldValue={setFieldValue} />
      ),
      createMockUser({ Role: 1 })
    )
  );
  return render(<Wrapped />);
}
