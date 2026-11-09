import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';

import { CommandsTab } from './CommandsTab';
import { Values } from './types';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));

vi.mock('@/react/docker/proxy/queries/usePlugins', () => ({
  useLoggingPlugins: () => ({ data: ['json-file'] }),
}));

describe('REQ-CTR-03 CommandsTab', () => {
  it('updates command, entrypoint, working dir, user and console', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    const values: Values = {
      cmd: null,
      entrypoint: null,
      workingDir: '',
      user: '',
      console: 'none',
      logConfig: { type: '', options: [] },
    };

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => (
          <CommandsTab
            apiVersion={1.41}
            values={values}
            setFieldValue={setFieldValue}
          />
        ),
        createMockUser()
      )
    );
    render(<Wrapped />);

    await user.click(
      screen.getByTestId('docker-container-override-command-input')
    );
    expect(setFieldValue).toHaveBeenCalledWith('cmd', '');

    await user.type(screen.getByTestId('working-dir-input'), '/app');
    expect(setFieldValue).toHaveBeenCalledWith(
      'workingDir',
      expect.any(String)
    );

    await user.type(screen.getByTestId('user-input'), 'nginx');
    expect(setFieldValue).toHaveBeenCalledWith('user', expect.any(String));

    await user.click(screen.getByTestId('container-console-interactive-tty'));
    expect(setFieldValue).toHaveBeenCalledWith('console', 'both');
  });
});
