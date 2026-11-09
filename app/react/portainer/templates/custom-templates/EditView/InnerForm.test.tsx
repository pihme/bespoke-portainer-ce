import { render, screen } from '@testing-library/react';
import { Formik } from 'formik';
import userEvent from '@testing-library/user-event';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { InnerForm } from './InnerForm';

vi.mock('@/react/portainer/custom-templates/components/CommonFields', () => ({
  CommonFields: () => <div>common-fields</div>,
}));
vi.mock('@/react/portainer/custom-templates/components/PlatformSelector', () => ({
  PlatformField: () => <div>platform</div>,
}));
vi.mock('@/react/portainer/custom-templates/components/TemplateTypeSelector', () => ({
  TemplateTypeSelector: () => <div>type</div>,
}));
vi.mock('@/react/portainer/custom-templates/components/utils', () => ({
  isTemplateVariablesEnabled: false,
}));
vi.mock('@/react/portainer/custom-templates/components/CustomTemplatesVariablesDefinitionField', () => ({
  CustomTemplatesVariablesDefinitionField: () => null,
}));
vi.mock('@/react/portainer/gitops/GitForm', () => ({
  GitForm: () => <div>git-form</div>,
}));
vi.mock('@/react/portainer/templates/custom-templates/CreateView/EdgeSettingsFieldset', () => ({
  EdgeSettingsFieldset: () => <div>edge-settings</div>,
}));
vi.mock('@/react/common/stacks/common/form-texts', () => ({
  textByType: {
    [StackType.DockerCompose]: {
      editor: { placeholder: 'compose tip', description: 'compose desc' },
    },
    [StackType.DockerSwarm]: {
      editor: { placeholder: 'swarm tip', description: 'swarm desc' },
    },
    [StackType.Kubernetes]: {
      editor: { placeholder: 'k8s tip', description: 'k8s desc' },
    },
  },
}));
vi.mock('../useParseTemplateOnFileChange', () => ({
  useParseTemplateOnFileChange: () => vi.fn(),
}));
vi.mock('@@/WebEditorForm', () => ({
  WebEditorForm: ({
    children,
    textTip,
  }: {
    children?: React.ReactNode;
    textTip?: string;
  }) => (
    <div>
      <div data-cy="tip">{textTip}</div>
      {children}
    </div>
  ),
  usePreventExit: vi.fn(),
}));
vi.mock('@@/form-components/FormActions', () => ({
  FormActions: () => <button type="submit">Update custom template</button>,
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
vi.mock('@@/form-components/FormError', () => ({
  FormError: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const baseValues = {
  Title: 'Nginx',
  Description: 'desc',
  Note: '',
  Logo: '',
  Platform: Platform.LINUX,
  Type: StackType.DockerCompose,
  FileContent: 'services: {}',
  Variables: [],
};

describe('REQ-TPL-03 InnerForm for local Compose edit', () => {
  it('renders compose editor fields without Kubernetes/edge arms', () => {
    render(
      <Formik initialValues={baseValues} onSubmit={vi.fn()}>
        <InnerForm isLoading={false} isEditorReadonly={false} />
      </Formik>
    );
    expect(screen.getByText('common-fields')).toBeVisible();
    expect(screen.getByText('platform')).toBeVisible();
    expect(screen.getByText('type')).toBeVisible();
    expect(screen.getByText('compose desc')).toBeVisible();
    expect(screen.queryByText('edge-settings')).toBeNull();
  });

  it('shows git reload controls and error for git-backed templates', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    render(
      <Formik
        initialValues={{
          ...baseValues,
          Git: { RepositoryURL: 'https://example.com/repo.git' },
        }}
        onSubmit={vi.fn()}
      >
        <InnerForm
          isLoading={false}
          isEditorReadonly
          gitFileContent="from-git"
          gitFileError="boom"
          refreshGitFile={refresh}
        />
      </Formik>
    );
    expect(screen.getByText('git-form')).toBeVisible();
    expect(screen.getByTestId('tip')).toHaveTextContent(
      'Preview of the file from git repository'
    );
    expect(screen.getByText(/Custom template could not be loaded, boom/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Reload custom template/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it('hides platform/type selectors for Kubernetes templates', () => {
    render(
      <Formik
        initialValues={{ ...baseValues, Type: StackType.Kubernetes }}
        onSubmit={vi.fn()}
      >
        <InnerForm isLoading={false} isEditorReadonly={false} />
      </Formik>
    );
    expect(screen.queryByText('platform')).toBeNull();
    expect(screen.queryByText('type')).toBeNull();
  });

  it('REQ-TAI-001 renders no access control section', () => {
    render(
      <Formik initialValues={baseValues} onSubmit={vi.fn()}>
        <InnerForm isLoading={false} isEditorReadonly={false} />
      </Formik>
    );
    expect(screen.queryByText(/access control/i)).toBeNull();
  });
});
