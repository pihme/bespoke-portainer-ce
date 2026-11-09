import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockUser } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { ContainerEngine } from '@/react/portainer/environments/types';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { ListView } from './ListView';

const templates = [
  {
    Id: 5,
    Title: 'Local Compose',
    Description: 'desc',
    ProjectPath: '/data/5',
    EntryPoint: 'docker-compose.yml',
    CreatedByUserId: 1,
    Note: '',
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    Variables: [],
  },
];

const mutate = vi.fn();
let confirmResult = true;
let selectedTemplateId: number | undefined;
let viewType: string = ContainerEngine.Docker;

vi.mock('./useViewParams', () => ({
  useViewParams: () => ({
    params: {
      edge: false,
      type: [StackType.DockerCompose, StackType.DockerSwarm],
    },
    getTemplateLinkParams: (template: { Id: number }) => ({
      to: '.',
      params: { template: template.Id },
    }),
    storageKey: 'docker-custom-templates',
    viewType,
  }),
}));

vi.mock('../queries/useCustomTemplates', () => ({
  useCustomTemplates: () => ({ data: templates }),
}));

vi.mock('../queries/useDeleteTemplateMutation', () => ({
  useDeleteTemplateMutation: () => ({ mutate }),
}));

vi.mock('@/react/hooks/useParamState', () => ({
  useParamState: (
    _key: string,
    parse?: (param: string | undefined) => number
  ) => {
    const raw = selectedTemplateId ? String(selectedTemplateId) : undefined;
    const value = parse ? parse(raw) : selectedTemplateId;
    return [value, vi.fn()];
  },
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: () => Promise.resolve(confirmResult),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('./StackFromCustomTemplateFormWidget', () => ({
  StackFromCustomTemplateFormWidget: ({
    templateId,
  }: {
    templateId: number;
  }) => <div data-cy="deploy-widget">deploy {templateId}</div>,
}));

vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
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

function renderView() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ListView), createMockUser())
  );
  return render(<Wrapped />);
}

describe('REQ-TPL-03 ListView', () => {
  beforeEach(() => {
    mutate.mockReset();
    confirmResult = true;
    selectedTemplateId = undefined;
    viewType = ContainerEngine.Docker;
  });

  it('lists custom templates for local Compose use', () => {
    renderView();
    expect(screen.getByText('Local Compose')).toBeVisible();
  });

  it('shows the deploy widget when a docker template is selected', () => {
    selectedTemplateId = 5;
    renderView();
    expect(screen.getByTestId('deploy-widget')).toHaveTextContent('deploy 5');
  });

  it('deletes a template after confirmation', async () => {
    const user = userEvent.setup();
    const { notifySuccess } = await import(
      '@/portainer/services/notifications'
    );
    renderView();

    await user.click(screen.getByText('Delete'));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, options] = mutate.mock.calls[0];
    options.onSuccess();
    expect(notifySuccess).toHaveBeenCalledWith('Success', 'Template deleted');
  });

  it('does not delete when the user cancels confirmation', async () => {
    confirmResult = false;
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText('Delete'));
    await waitFor(() => expect(mutate).not.toHaveBeenCalled());
  });
});
