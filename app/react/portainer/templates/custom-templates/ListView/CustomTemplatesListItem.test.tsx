import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { Role } from '@/portainer/users/types';

import { CustomTemplate } from '../types';

import { CustomTemplatesListItem } from './CustomTemplatesListItem';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

const template: CustomTemplate = {
  Id: 11,
  Title: 'Compose App',
  Description: 'local compose',
  ProjectPath: '/data/custom_template/11',
  EntryPoint: 'docker-compose.yml',
  CreatedByUserId: 1,
  Note: '',
  Platform: Platform.LINUX,
  Logo: '',
  Type: StackType.DockerCompose,
  Variables: [],
};

let isAdminLoading = false;
let isAdmin = true;

vi.mock('@/react/hooks/useUser', async () => {
  const actual = await vi.importActual<typeof import('@/react/hooks/useUser')>(
    '@/react/hooks/useUser'
  );
  return {
    ...actual,
    useIsEdgeAdmin: () => ({
      isLoading: isAdminLoading,
      isAdmin,
    }),
  };
});

function renderItem(
  overrides: Partial<React.ComponentProps<typeof CustomTemplatesListItem>> = {}
) {
  const onDelete = vi.fn();
  const onSelect = vi.fn();
  const Wrapped = withUserProvider(
    withTestRouter(() => (
      <CustomTemplatesListItem
        template={template}
        isSelected={false}
        onDelete={onDelete}
        onSelect={onSelect}
        linkParams={{ to: '.', params: { template: 11 } }}
        {...overrides}
      />
    )),
    createMockUser({ Id: 1, Role: Role.Admin })
  );
  return { ...render(<Wrapped />), onDelete, onSelect };
}

describe('REQ-TPL-03 CustomTemplatesListItem', () => {
  beforeEach(() => {
    isAdminLoading = false;
    isAdmin = true;
  });

  it('renders a compose template with edit and delete actions for an admin', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderItem();

    expect(screen.getByText('Compose App')).toBeVisible();
    expect(screen.getByText('standalone')).toBeVisible();

    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(11);
  });

  it('returns null while the admin check is loading', () => {
    isAdminLoading = true;
    renderItem();
    expect(screen.queryByText('Compose App')).not.toBeInTheDocument();
  });

  it('hides edit actions when the user is not allowed to edit', () => {
    isAdmin = false;
    renderItem({
      template: { ...template, CreatedByUserId: 99 },
    });

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('labels swarm template types', () => {
    renderItem({
      template: { ...template, Type: StackType.DockerSwarm },
    });
    expect(screen.getByText('swarm')).toBeVisible();
  });

  it('labels kubernetes template types', () => {
    renderItem({
      template: { ...template, Type: StackType.Kubernetes },
    });
    expect(screen.getByText('manifest')).toBeVisible();
  });
});

  it('invokes onSelect when the template item is selected', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderItem({ linkParams: undefined });

    await user.click(screen.getByLabelText('Compose App'));
    expect(onSelect).toHaveBeenCalledWith(11);
  });

  it('stops propagation when clicking Edit', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderItem({ linkParams: undefined });

    await user.click(screen.getByText('Edit'));
    expect(onSelect).not.toHaveBeenCalled();
  });

