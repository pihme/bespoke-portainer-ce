import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import type { CustomTemplate } from '@/react/portainer/templates/custom-templates/types';

import { DeployForm } from './DeployForm';

const mutate = vi.fn();
const go = vi.fn();
const notifySuccess = vi.fn();

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
vi.mock('./useValidation', () => ({
  useValidation: () => undefined,
}));
vi.mock('@/react/portainer/custom-templates/components/utils', () => ({
  isTemplateVariablesEnabled: false,
  renderTemplate: (file: string) => file,
}));
vi.mock(
  '@/react/portainer/custom-templates/components/CustomTemplatesVariablesField',
  () => ({
    CustomTemplatesVariablesField: () => null,
    getVariablesFieldDefaultValues: () => [],
  })
);
vi.mock(
  '@/react/portainer/templates/app-templates/DeployFormWidget/AdvancedSettings',
  () => ({
    AdvancedSettings: ({
      label,
      children,
    }: {
      label: (isOpen: boolean) => string;
      children: React.ReactNode;
    }) => (
      <div>
        <div data-cy="adv-closed">{label(false)}</div>
        <div data-cy="adv-open">{label(true)}</div>
        {children}
      </div>
    ),
  })
);
vi.mock('@@/WebEditorForm', () => ({
  WebEditorForm: ({
    value,
    onChange,
    children,
  }: {
    value: string;
    onChange: (v: string) => void;
    children?: React.ReactNode;
  }) => (
    <div>
      <textarea
        aria-label="File content"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </div>
  ),
}));
vi.mock('@@/form-components/FormActions', () => ({
  FormActions: ({
    children,
  }: {
    children?: React.ReactNode;
    isValid?: boolean;
  }) => (
    <div>
      <button type="submit">Deploy the stack</button>
      {children}
    </div>
  ),
}));
vi.mock('@@/form-components/FormSection', () => ({
  FormSection: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@@/buttons', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

function composeTemplate(
  overrides: Partial<CustomTemplate> = {}
): CustomTemplate {
  return {
    Id: 7,
    Title: 'Nginx',
    Description: 'web',
    ProjectPath: '/data/custom_template/7',
    EntryPoint: 'docker-compose.yml',
    CreatedByUserId: 1,
    Note: '',
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    Variables: [],
    IsComposeFormat: false,
    ...overrides,
  };
}

describe('REQ-TPL-03 DeployForm for local Compose custom templates', () => {
  beforeEach(() => {
    mutate.mockReset();
    go.mockReset();
    notifySuccess.mockReset();
  });

  it('renders the local Compose editor and customize labels', () => {
    render(
      <DeployForm
        template={composeTemplate()}
        templateFile="services: {}"
        isDeployable
      />
    );

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('File content')).toHaveValue('services: {}');
    expect(screen.getByTestId('adv-closed')).toHaveTextContent(
      'Customize stack'
    );
    expect(screen.getByTestId('adv-open')).toHaveTextContent(
      'Hide custom stack'
    );
    // REQ-TAI-001: no ownership section
    expect(screen.queryByText(/access control/i)).not.toBeInTheDocument();
  });

  it('submits a standalone string stack payload for Compose templates', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());

    render(
      <DeployForm
        template={composeTemplate()}
        templateFile="services: {}"
        isDeployable
      />
    );

    await user.type(screen.getByLabelText('Name'), 'mystack');
    await user.click(
      screen.getByRole('button', { name: 'Deploy the stack' })
    );

    expect(mutate).toHaveBeenCalledWith(
      {
        type: 'standalone',
        method: 'string',
        payload: expect.objectContaining({
          name: 'mystack',
          environmentId: 3,
          fileContent: 'services: {}',
        }),
      },
      expect.any(Object)
    );
    expect(notifySuccess).toHaveBeenCalledWith('Success', 'Stack created');
    expect(go).toHaveBeenCalledWith('docker.stacks');
  });

  it('updates the editor content for non-git templates', async () => {
    const user = userEvent.setup();
    render(
      <DeployForm
        template={composeTemplate()}
        templateFile="old"
        isDeployable
      />
    );

    const editor = screen.getByLabelText('File content');
    await user.clear(editor);
    await user.type(editor, 'new-content');
    expect(editor).toHaveValue('new-content');
  });
});
