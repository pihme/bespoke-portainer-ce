import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { object, string, number, mixed, array } from 'yup';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { CreateForm } from './CreateForm';

const mockMutate = vi.fn();
const mockGo = vi.fn();
const mockNotifySuccess = vi.fn();
const mockUseInitialValues = vi.fn();
const mockUseValidation = vi.fn();
const mockUseCurrentEnvironment = vi.fn();
const mockUseEnvironmentDeploymentOptions = vi.fn();

vi.mock('@uirouter/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@uirouter/react')>()),
  useRouter: () => ({ stateService: { go: mockGo } }),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args),
}));

vi.mock('@/react/portainer/templates/custom-templates/queries/useCreateTemplateMutation', () => ({
  useCreateTemplateMutation: () => ({
    isLoading: false,
    mutate: mockMutate,
  }),
}));

vi.mock('./useInitialValues', () => ({
  useInitialValues: (...args: unknown[]) => mockUseInitialValues(...args),
}));

vi.mock('./useValidation', () => ({
  useValidation: (...args: unknown[]) => mockUseValidation(...args),
}));

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: (...args: unknown[]) =>
    mockUseCurrentEnvironment(...args),
}));

vi.mock('@/react/portainer/environments/queries/useEnvironment', () => ({
  useEnvironmentDeploymentOptions: (...args: unknown[]) =>
    mockUseEnvironmentDeploymentOptions(...args),
}));

vi.mock('./InnerForm', () => ({
  InnerForm: ({
    isLoading,
    environmentId,
    buildMethods,
  }: {
    isLoading: boolean;
    environmentId?: number;
    buildMethods: Array<{ value: string; label: string }>;
  }) => {
    const { useFormikContext } = require('formik') as typeof import('formik');
    const { values, submitForm } = useFormikContext<{
      Title: string;
      Method: string;
    }>();
    return (
      <div>
        <div data-cy="inner-form">
          loading:{String(isLoading)} env:{String(environmentId ?? '')} methods:
          {buildMethods.map((m) => m.value).join(',')}
        </div>
        <div data-cy="form-title">{values.Title}</div>
        <div data-cy="form-method">{values.Method}</div>
        <button type="button" onClick={() => submitForm()}>
          Submit create
        </button>
      </div>
    );
  },
}));

const baseValues = {
  Title: 'my-template',
  Description: 'desc',
  Note: '',
  Logo: '',
  Platform: Platform.LINUX,
  Type: StackType.DockerCompose,
  Method: 'editor' as const,
  FileContent: 'services:\n  web:\n    image: nginx',
  File: undefined,
  Git: {
    SourceId: 0,
    RepositoryReferenceName: '',
    ComposeFilePathInRepository: 'docker-compose.yml',
    AdditionalFiles: [],
  },
  Variables: [],
  EdgeSettings: undefined,
};

function renderForm(
  props: Partial<React.ComponentProps<typeof CreateForm>> = {}
) {
  const Wrapped = withTestQueryProvider(() => (
    <CreateForm
      environmentId={1}
      viewType="docker"
      defaultType={StackType.DockerCompose}
      {...props}
    />
  ));
  return render(<Wrapped />);
}

describe('REQ-TPL-03 CreateForm', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockGo.mockReset();
    mockNotifySuccess.mockReset();
    mockUseInitialValues.mockReset();
    mockUseValidation.mockReset();
    mockUseCurrentEnvironment.mockReset();
    mockUseEnvironmentDeploymentOptions.mockReset();

    mockUseInitialValues.mockReturnValue(baseValues);
    mockUseValidation.mockReturnValue(
      object({
        Title: string().required(),
        Description: string(),
        Note: string(),
        Logo: string(),
        Platform: number(),
        Type: number(),
        Method: string(),
        FileContent: string(),
        File: mixed().nullable(),
        Git: mixed(),
        Variables: array(),
        EdgeSettings: mixed().nullable(),
      })
    );
    mockUseCurrentEnvironment.mockReturnValue({
      data: { Id: 1, Type: EnvironmentType.Docker },
    });
    mockUseEnvironmentDeploymentOptions.mockReturnValue({ data: undefined });
  });

  it('returns null while initial values are still loading', () => {
    mockUseInitialValues.mockReturnValue(undefined);
    const { container } = renderForm();
    expect(container).toBeEmptyDOMElement();
  });

  it('passes compose deploy method and docker build methods into validation/initial values', () => {
    renderForm();

    expect(mockUseValidation).toHaveBeenCalledWith({
      viewType: 'docker',
      deployMethod: 'compose',
    });
    expect(mockUseInitialValues).toHaveBeenCalledWith({
      defaultType: StackType.DockerCompose,
      isEdge: false,
      buildMethods: ['editor', 'upload', 'repository'],
    });
    expect(screen.getByTestId('inner-form')).toHaveTextContent(
      'methods:editor,upload,repository'
    );
    expect(screen.getByTestId('form-title')).toHaveTextContent('my-template');
  });

  it('REQ-TAI-002 never uses the Kubernetes manifest deploy method', () => {
    renderForm({
      defaultType: StackType.Kubernetes,
      viewType: 'docker',
    });

    expect(mockUseValidation).toHaveBeenCalledWith({
      viewType: 'docker',
      deployMethod: 'compose',
    });
  });

  it('treats a missing environmentId as edge and still shows all build methods', () => {
    renderForm({ environmentId: undefined, viewType: 'edge' });

    expect(mockUseInitialValues).toHaveBeenCalledWith(
      expect.objectContaining({ isEdge: true })
    );
    expect(screen.getByTestId('inner-form')).toHaveTextContent('env:');
  });

  it('hides editor and upload when kubernetes deployment options say so', () => {
    mockUseCurrentEnvironment.mockReturnValue({
      data: { Id: 9, Type: EnvironmentType.KubernetesLocal },
    });
    mockUseEnvironmentDeploymentOptions.mockReturnValue({
      data: { hideWebEditor: true, hideFileUpload: true },
    });

    renderForm({
      environmentId: 9,
      viewType: 'docker',
      defaultType: StackType.DockerCompose,
    });

    expect(mockUseEnvironmentDeploymentOptions).toHaveBeenCalledWith(9);
    expect(mockUseInitialValues).toHaveBeenCalledWith(
      expect.objectContaining({ buildMethods: ['repository'] })
    );
    expect(screen.getByTestId('inner-form')).toHaveTextContent(
      'methods:repository'
    );
  });

  it('submits create mutation, notifies success and navigates back', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_values, options) => {
      options?.onSuccess?.();
    });

    renderForm();
    await user.click(screen.getByRole('button', { name: 'Submit create' }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          Title: 'my-template',
          Method: 'editor',
          EdgeTemplate: false,
        }),
        expect.any(Object)
      );
    });
    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'Success',
      'Template created'
    );
    expect(mockGo).toHaveBeenCalledWith('^');
  });

  it('marks EdgeTemplate true when creating without an environment', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_values, options) => {
      options?.onSuccess?.();
    });

    renderForm({ environmentId: undefined, viewType: 'edge' });
    await user.click(screen.getByRole('button', { name: 'Submit create' }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ EdgeTemplate: true }),
        expect.any(Object)
      );
    });
  });
});
