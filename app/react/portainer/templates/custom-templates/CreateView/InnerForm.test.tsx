import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import { FormValues, initialBuildMethods } from './types';
import { InnerForm } from './InnerForm';

const mockHandleChangeFileContent = vi.fn();
const mockUsePreventExit = vi.fn();

vi.mock('@@/WebEditorForm', () => ({
  WebEditorForm: ({
    value,
    onChange,
    error,
    children,
  }: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    children?: React.ReactNode;
  }) => (
    <div>
      <label htmlFor="editor">Web editor</label>
      <textarea
        id="editor"
        data-cy="custom-template-creation-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <span>{error}</span> : null}
      {children}
    </div>
  ),
  usePreventExit: (...args: unknown[]) => mockUsePreventExit(...args),
}));

vi.mock('@@/form-components/FileUpload', () => ({
  FileUploadForm: ({
    value,
    onChange,
    description,
  }: {
    value?: File;
    onChange: (file: File) => void;
    description: string;
  }) => (
    <div>
      <p>{description}</p>
      <button
        type="button"
        data-cy="custom-template-creation-file-upload"
        onClick={() =>
          onChange(new File(['x'], 'compose.yml', { type: 'text/yaml' }))
        }
      >
        Choose file {value?.name ?? ''}
      </button>
    </div>
  ),
}));

vi.mock('@/react/portainer/gitops/GitForm', () => ({
  GitForm: ({
    value,
    onChange,
    deployMethod,
  }: {
    value: { SourceId: number };
    onChange: (values: Partial<{ SourceId: number }>) => void;
    deployMethod: string;
  }) => (
    <div data-cy="git-form" data-deploy-method={deployMethod}>
      <button type="button" onClick={() => onChange({ SourceId: 9 })}>
        Set git source {value.SourceId}
      </button>
    </div>
  ),
}));

vi.mock('@/react/portainer/access-control', () => ({
  AccessControlForm: ({
    values,
    onChange,
  }: {
    values: { ownership: string };
    onChange: (values: { ownership: string }) => void;
  }) => (
    <div data-cy="access-control">
      <button
        type="button"
        onClick={() =>
          onChange({ ownership: ResourceControlOwnership.PUBLIC })
        }
      >
        Access {values.ownership}
      </button>
    </div>
  ),
}));

vi.mock('@/react/portainer/custom-templates/components/utils', () => ({
  isTemplateVariablesEnabled: true,
}));

vi.mock(
  '@/react/portainer/custom-templates/components/CustomTemplatesVariablesDefinitionField',
  () => ({
    CustomTemplatesVariablesDefinitionField: ({
      value,
      onChange,
      isVariablesNamesFromParent,
    }: {
      value: unknown[];
      onChange: (values: unknown[]) => void;
      isVariablesNamesFromParent: boolean;
    }) => (
      <div
        data-cy="variables-field"
        data-from-parent={String(isVariablesNamesFromParent)}
      >
        <button type="button" onClick={() => onChange([{ name: 'PORT' }])}>
          Add variable ({value.length})
        </button>
      </div>
    ),
  })
);

vi.mock('./EdgeSettingsFieldset', () => ({
  EdgeSettingsFieldset: ({
    values,
    setValues,
  }: {
    values: { PrePullImage: boolean };
    setValues: (values: { PrePullImage: boolean }) => void;
  }) => (
    <div data-cy="edge-settings">
      <button
        type="button"
        onClick={() => setValues({ PrePullImage: true })}
      >
        Edge prepull {String(values.PrePullImage)}
      </button>
    </div>
  ),
}));

vi.mock('../useParseTemplateOnFileChange', () => ({
  useParseTemplateOnFileChange: () => mockHandleChangeFileContent,
}));

vi.mock('@/react/portainer/custom-templates/components/CommonFields', () => ({
  CommonFields: ({
    values,
    onChange,
  }: {
    values: { Title: string };
    onChange: (values: Partial<FormValues>) => void;
  }) => (
    <div>
      <label htmlFor="title">Title</label>
      <input
        id="title"
        data-cy="custom-templates-title-input"
        value={values.Title}
        onChange={(e) => onChange({ Title: e.target.value })}
      />
    </div>
  ),
}));

vi.mock('@/react/portainer/custom-templates/components/PlatformSelector', () => ({
  PlatformField: ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (value: number) => void;
  }) => (
    <button type="button" onClick={() => onChange(Platform.WINDOWS)}>
      Platform {value}
    </button>
  ),
}));

vi.mock(
  '@/react/portainer/custom-templates/components/TemplateTypeSelector',
  () => ({
    TemplateTypeSelector: ({
      value,
      onChange,
    }: {
      value: number;
      onChange: (value: number) => void;
    }) => (
      <button
        type="button"
        onClick={() => onChange(StackType.DockerSwarm)}
      >
        Type {value}
      </button>
    ),
  })
);

function baseValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    Title: 'tpl',
    Description: 'd',
    Note: '',
    Logo: '',
    Platform: Platform.LINUX,
    Type: StackType.DockerCompose,
    Method: 'editor',
    FileContent: 'services: {}',
    File: undefined,
    Git: {
      SourceId: 0,
      RepositoryReferenceName: '',
      ComposeFilePathInRepository: 'docker-compose.yml',
      AdditionalFiles: [],
    },
    Variables: [],
    AccessControl: {
      ownership: ResourceControlOwnership.ADMINISTRATORS,
      authorizedUsers: [],
      authorizedTeams: [],
    },
    EdgeSettings: undefined,
    ...overrides,
  };
}

function renderInner(
  values: FormValues = baseValues(),
  props: Partial<React.ComponentProps<typeof InnerForm>> = {}
) {
  return render(
    <Formik initialValues={values} onSubmit={vi.fn()} validateOnMount>
      <InnerForm
        isLoading={false}
        environmentId={1}
        buildMethods={[...initialBuildMethods]}
        {...props}
      />
    </Formik>
  );
}

describe('REQ-TPL-03 / REQ-TPL-04 InnerForm', () => {
  beforeEach(() => {
    mockHandleChangeFileContent.mockReset();
    mockUsePreventExit.mockReset();
  });

  it('renders local compose create fields for the editor method', () => {
    renderInner();

    expect(screen.getByLabelText('Title')).toHaveValue('tpl');
    expect(screen.getByRole('radio', { name: /web editor/i })).toBeChecked();
    expect(
      screen.getByTestId('custom-template-creation-editor')
    ).toBeInTheDocument();
    expect(screen.getByTestId('variables-field')).toHaveAttribute(
      'data-from-parent',
      'true'
    );
    expect(screen.getByTestId('access-control')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create custom template/i })
    ).toBeInTheDocument();
    expect(mockUsePreventExit).toHaveBeenCalled();
  });

  it('hides platform and template type selectors for kubernetes templates', () => {
    renderInner(baseValues({ Type: StackType.Kubernetes }));

    expect(screen.queryByRole('button', { name: /Platform/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Type / })).toBeNull();
  });

  it('switches to upload and clears editor content and variables', async () => {
    const user = userEvent.setup();
    renderInner(
      baseValues({
        FileContent: 'old',
        Variables: [{ name: 'A', label: '', defaultValue: '', description: '' }],
      })
    );

    await user.click(screen.getByRole('radio', { name: /upload/i }));

    expect(screen.getByRole('radio', { name: /upload/i })).toBeChecked();
    expect(
      screen.getByText(/upload a Compose file from your computer/i)
    ).toBeVisible();
    expect(screen.queryByTestId('custom-template-creation-editor')).toBeNull();
    expect(screen.getByTestId('variables-field')).toHaveAttribute(
      'data-from-parent',
      'false'
    );
  });

  it('stores the chosen upload file', async () => {
    const user = userEvent.setup();
    renderInner(baseValues({ Method: 'upload', FileContent: '' }));

    await user.click(
      screen.getByTestId('custom-template-creation-file-upload')
    );

    expect(
      screen.getByTestId('custom-template-creation-file-upload')
    ).toHaveTextContent('compose.yml');
  });

  it('shows the git form with compose deploy method for repository builds', async () => {
    const user = userEvent.setup();
    renderInner();

    await user.click(screen.getByRole('radio', { name: /repository/i }));

    const git = await screen.findByTestId('git-form');
    expect(git).toHaveAttribute('data-deploy-method', 'compose');
    await user.click(screen.getByRole('button', { name: /Set git source/i }));
    expect(
      screen.getByRole('button', { name: /Set git source 9/i })
    ).toBeInTheDocument();
  });

  it('uses manifest deploy method when the template type is kubernetes', () => {
    renderInner(
      baseValues({ Method: 'repository', Type: StackType.Kubernetes })
    );

    expect(screen.getByTestId('git-form')).toHaveAttribute(
      'data-deploy-method',
      'manifest'
    );
  });

  it('updates platform, type, title, variables and access control', async () => {
    const user = userEvent.setup();
    renderInner();

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'renamed');
    expect(screen.getByLabelText('Title')).toHaveValue('renamed');

    await user.click(screen.getByRole('button', { name: /Platform 1/i }));
    expect(
      screen.getByRole('button', { name: /Platform 2/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`Type ${StackType.DockerCompose}`),
      })
    );
    expect(
      screen.getByRole('button', {
        name: new RegExp(`Type ${StackType.DockerSwarm}`),
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add variable/i }));
    expect(
      screen.getByRole('button', { name: /Add variable \(1\)/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Access/i }));
    expect(
      screen.getByRole('button', {
        name: new RegExp(`Access ${ResourceControlOwnership.PUBLIC}`),
      })
    ).toBeInTheDocument();
  });

  it('renders edge settings when EdgeSettings are present', async () => {
    const user = userEvent.setup();
    renderInner(
      baseValues({
        AccessControl: undefined,
        EdgeSettings: {
          PrePullImage: false,
          RetryDeploy: false,
          PrivateRegistryId: undefined,
          RelativePathSettings: {} as never,
          StaggerConfig: {} as never,
        },
      })
    );

    expect(screen.queryByTestId('access-control')).toBeNull();
    expect(screen.getByTestId('edge-settings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Edge prepull/i }));
    expect(
      screen.getByRole('button', { name: /Edge prepull true/i })
    ).toBeInTheDocument();
  });

  it('wires editor changes through the template parse helper', async () => {
    const user = userEvent.setup();
    renderInner();

    await user.type(
      screen.getByTestId('custom-template-creation-editor'),
      'x'
    );
    expect(mockHandleChangeFileContent).toHaveBeenCalled();
  });
});
