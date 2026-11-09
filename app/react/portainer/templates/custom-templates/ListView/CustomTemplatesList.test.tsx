import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { CustomTemplate } from '../types';

import { CustomTemplatesList } from './CustomTemplatesList';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

vi.mock('@/react/hooks/useUser', async () => {
  const actual = await vi.importActual<typeof import('@/react/hooks/useUser')>(
    '@/react/hooks/useUser'
  );
  return {
    ...actual,
    useIsEdgeAdmin: () => ({ isLoading: false, isAdmin: true }),
  };
});

const templates: CustomTemplate[] = [
  {
    Id: 1,
    Title: 'Nginx',
    Description: 'web',
    ProjectPath: '/data/1',
    EntryPoint: 'docker-compose.yml',
    CreatedByUserId: 1,
    Note: 'note-nginx',
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    Variables: [],
  },
  {
    Id: 2,
    Title: 'Redis',
    Description: 'cache',
    ProjectPath: '/data/2',
    EntryPoint: 'docker-compose.yml',
    CreatedByUserId: 1,
    Note: '',
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    Variables: [],
  },
];

function renderList(
  props: Partial<React.ComponentProps<typeof CustomTemplatesList>> = {}
) {
  const onDelete = vi.fn();
  const Wrapped = withUserProvider(
    withTestRouter(() => (
      <CustomTemplatesList
        templates={templates}
        onDelete={onDelete}
        storageKey="docker-custom-templates-test"
        templateLinkParams={(t) => ({
          to: '.',
          params: { template: t.Id },
        })}
        {...props}
      />
    )),
    createMockUser()
  );
  return { ...render(<Wrapped />), onDelete };
}

describe('REQ-TPL-03 CustomTemplatesList', () => {
  it('lists custom templates for local Compose use', () => {
    renderList();

    expect(screen.getByText('Nginx')).toBeVisible();
    expect(screen.getByText('Redis')).toBeVisible();
    expect(screen.getByText('Add Custom Template')).toBeVisible();
  });

  it('shows a loading placeholder when templates are undefined', () => {
    renderList({ templates: undefined });
    expect(screen.getByText('Loading...')).toBeVisible();
  });

  it('shows an empty message when there are no templates', () => {
    renderList({ templates: [] });
    expect(screen.getByText('No templates available.')).toBeVisible();
  });
});

  it('filters templates by title description and note', async () => {
    const user = userEvent.setup();
    renderList();

    const search = screen.getByLabelText('Search input');
    await user.clear(search);
    await user.type(search, 'note-nginx');

    await waitFor(() => {
      expect(screen.getByText('Nginx')).toBeVisible();
      expect(screen.queryByText('Redis')).not.toBeInTheDocument();
    });
  });

