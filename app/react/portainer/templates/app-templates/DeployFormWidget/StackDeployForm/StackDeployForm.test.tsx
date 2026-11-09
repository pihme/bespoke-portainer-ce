import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplateType } from '../../types';
import { TemplateViewModel } from '../../view-model';

import { StackDeployForm } from './StackDeployForm';

const mutate = vi.fn();
const go = vi.fn();
const notifySuccess = vi.fn();
const useIsDeployable = vi.fn(() => true);

vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));
vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 3,
}));
vi.mock('@/react/docker/stacks/common/NameField', () => ({
  NameField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="Name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock('@/react/common/stacks/queries/useCreateStack/useCreateStack', () => ({
  useCreateStack: () => ({ mutate, isLoading: false }),
}));
vi.mock('../EnvVarsFieldset', () => ({
  EnvVarsFieldset: () => <div>env-vars</div>,
}));
vi.mock('./useValidation', () => ({
  useValidation: () => undefined,
}));
vi.mock('./useIsDeployable', () => ({
  useIsDeployable: (...args: unknown[]) => useIsDeployable(...args),
}));

function template(
  type: TemplateType = TemplateType.ComposeStack
): TemplateViewModel {
  return {
    Id: 2,
    Title: 'Compose App',
    Name: 'stack',
    Type: type,
    Env: [{ name: 'FOO', value: 'bar', type: 2 }],
    Repository: {
      url: 'https://example.com/repo.git',
      stackfile: 'docker-compose.yml',
    },
  } as TemplateViewModel;
}

describe('REQ-TPL-01 StackDeployForm for compose templates', () => {
  beforeEach(() => {
    mutate.mockReset();
    go.mockReset();
    notifySuccess.mockReset();
    useIsDeployable.mockReturnValue(true);
  });

  it('shows a tip when the template is not deployable', () => {
    useIsDeployable.mockReturnValue(false);
    render(<StackDeployForm template={template()} unselect={vi.fn()} />);
    expect(
      screen.getByText(
        'This template type cannot be deployed on this environment.'
      )
    ).toBeVisible();
  });

  it('renders the compose deploy form and hides on cancel', async () => {
    const user = userEvent.setup();
    const unselect = vi.fn();
    render(<StackDeployForm template={template()} unselect={unselect} />);

    expect(screen.getByLabelText('Name')).toHaveValue('stack');
    expect(screen.getByText('env-vars')).toBeVisible();
    // REQ-TAI-001: no ownership section
    expect(screen.queryByText(/access control/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(unselect).toHaveBeenCalled();
  });

  it('submits a standalone git stack payload for compose templates', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());

    render(<StackDeployForm template={template()} unselect={vi.fn()} />);

    await user.click(
      screen.getByRole('button', { name: 'Deploy the stack' })
    );

    expect(mutate).toHaveBeenCalledWith(
      {
        type: 'standalone',
        method: 'git',
        payload: expect.objectContaining({
          name: 'stack',
          environmentId: 3,
          fromAppTemplate: true,
          git: {
            RepositoryURL: 'https://example.com/repo.git',
            ComposeFilePathInRepository: 'docker-compose.yml',
          },
          env: [{ name: 'FOO', value: 'bar' }],
        }),
      },
      expect.any(Object)
    );
    // REQ-TAI-003: no Docker Swarm id in the payload
    expect(mutate.mock.calls[0][0].payload).not.toHaveProperty('swarmId');
    expect(notifySuccess).toHaveBeenCalledWith('Success', 'Stack created');
    expect(go).toHaveBeenCalledWith('docker.stacks');
  });
});
