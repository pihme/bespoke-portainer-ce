import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { select } from '@/react/test-utils/react-select';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';

import { LoggerConfig } from './LoggerConfig';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));

vi.mock('@/react/docker/proxy/queries/usePlugins', () => ({
  useLoggingPlugins: () => ({ data: ['json-file', 'local'] }),
}));

describe('REQ-CTR-03 LoggerConfig', () => {
  it('renders logging drivers and enables option rows for a selected driver', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => (
          <LoggerConfig
            value={{ type: 'json-file', options: [] }}
            onChange={onChange}
            apiVersion={1.41}
          />
        ),
        createMockUser()
      )
    );
    render(<Wrapped />);

    expect(await screen.findByText('Logging')).toBeVisible();
    expect(
      screen.getByText(/override the default docker daemon driver/i)
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onChange).toHaveBeenCalledWith({
      type: 'json-file',
      options: [{ option: '', value: '' }],
    });
  });

  it('changes the selected logging driver', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => (
          <LoggerConfig
            value={{ type: '', options: [] }}
            onChange={onChange}
            apiVersion={1.41}
          />
        ),
        createMockUser()
      )
    );
    render(<Wrapped />);

    const input = await screen.findByRole('combobox');
    await select(input, 'local', { user });
    expect(onChange).toHaveBeenCalledWith({
      type: 'local',
      options: [],
    });
  });

  it('keeps option add disabled for the default driver', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => (
          <LoggerConfig
            value={{ type: '', options: [] }}
            onChange={vi.fn()}
            apiVersion={1.41}
          />
        ),
        createMockUser()
      )
    );
    render(<Wrapped />);

    expect(await screen.findByRole('button', { name: 'Add item' })).toBeDisabled();
  });
});
