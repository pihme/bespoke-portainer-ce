import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockStack, createMockUser } from '@/react-tools/test-mocks';
import { StackType } from '@/react/common/stacks/types';
import { server } from '@/setup-tests/server';

import { StackDetails } from './StackDetails';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

vi.mock('./StackInfoTab/StackInfoTab', () => ({
  StackInfoTab: ({
    stackName,
    stackFileContent,
  }: {
    stackName: string;
    stackFileContent?: string;
  }) => (
    <div
      data-cy="stack-info-tab"
      data-stack-name={stackName}
      data-has-file={String(!!stackFileContent)}
    />
  ),
}));

vi.mock('./StackEditorTab/StackEditorTab', () => ({
  StackEditorTab: () => <div data-cy="stack-editor-tab" />,
}));

vi.mock('../../containers/queries/useContainers', () => ({
  useContainers: () => ({ data: ['web', 'db'] }),
}));

describe('REQ-STK-04 StackDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the info widget for an external stack', async () => {
    server.use(
      http.get('/api/stacks/:id/file', () =>
        HttpResponse.json({ StackFileContent: 'services: {}' })
      )
    );

    renderComponent({
      isExternal: true,
      stack: createMockStack({ Type: StackType.DockerCompose }),
    });

    expect(await screen.findByTestId('stack-info-tab')).toBeVisible();
    expect(screen.queryByTestId('stack-editor-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-1')).not.toBeInTheDocument();
  });

  it('shows info and editor tabs for a regular non-git stack once the file loads', async () => {
    server.use(
      http.get('/api/stacks/:id/file', () =>
        HttpResponse.json({
          StackFileContent: 'services:\n  web:\n    image: nginx\n',
        })
      )
    );

    renderComponent({
      isExternal: false,
      isRegular: true,
      stack: createMockStack({
        Type: StackType.DockerCompose,
        GitConfig: undefined,
        FromAppTemplate: false,
      }),
    });

    expect(await screen.findByTestId('tab-0')).toBeVisible();
    expect(screen.getByTestId('tab-1')).toBeVisible();
    expect(screen.getByTestId('stack-info-tab')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByTestId('stack-info-tab')).toHaveAttribute(
        'data-has-file',
        'true'
      );
    });
  });

  it('hides the editor tab while a git-backed stack is not from an app template', async () => {
    const stack = createMockStack({
      Type: StackType.DockerCompose,
      FromAppTemplate: false,
      GitConfig: {
        URL: 'https://github.com/test/repo',
        ReferenceName: 'main',
        ConfigFilePath: 'docker-compose.yml',
        ConfigHash: 'abc',
        TLSSkipVerify: false,
      },
    });

    server.use(
      http.get('/api/stacks/:id/file', () =>
        HttpResponse.json({ StackFileContent: 'services: {}' })
      )
    );

    renderComponent({
      isExternal: false,
      isRegular: true,
      stack,
    });

    expect(await screen.findByTestId('stack-info-tab')).toBeVisible();
    expect(screen.queryByTestId('tab-1')).not.toBeInTheDocument();
  });

  it('shows the editor for a git stack that was created from an app template', async () => {
    const stack = createMockStack({
      Type: StackType.DockerCompose,
      FromAppTemplate: true,
      GitConfig: {
        URL: 'https://github.com/test/repo',
        ReferenceName: 'main',
        ConfigFilePath: 'docker-compose.yml',
        ConfigHash: 'abc',
        TLSSkipVerify: false,
      },
    });

    server.use(
      http.get('/api/stacks/:id/file', () =>
        HttpResponse.json({ StackFileContent: 'services: {}' })
      )
    );

    renderComponent({
      isExternal: false,
      isRegular: true,
      stack,
    });

    expect(await screen.findByTestId('tab-1')).toBeVisible();
    expect(screen.getByTestId('tab-0')).toBeVisible();
  });
});

function renderComponent(
  overrides: Partial<React.ComponentProps<typeof StackDetails>> = {}
) {
  const user = createMockUser({ Role: 1 });
  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(StackDetails, user))
  );

  return render(
    <Wrapped
      isExternal={false}
      isOrphaned={false}
      isOrphanedRunning={false}
      isRegular
      stackName="test-stack"
      stack={createMockStack()}
      {...overrides}
    />
  );
}
