import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { EditForm } from './EditForm';

const mutate = vi.fn();
const go = vi.fn();
const notifySuccess = vi.fn();
const useInitialValues = vi.fn();
const useValidation = vi.fn(() => undefined);
const useCustomTemplateFile = vi.fn();
const useCurrentEnvironment = vi.fn(() => ({ data: undefined }));
const useEnvironmentDeploymentOptions = vi.fn(() => ({ data: undefined }));

vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));
vi.mock('../queries/useUpdateTemplateMutation', () => ({
  useUpdateTemplateMutation: () => ({ mutate, isLoading: false }),
}));
vi.mock('../queries/useCustomTemplateFile', () => ({
  useCustomTemplateFile: (...args: unknown[]) => useCustomTemplateFile(...args),
}));
vi.mock('./useInitialValues', () => ({
  useInitialValues: (...args: unknown[]) => useInitialValues(...args),
}));
vi.mock('./useValidation', () => ({
  useValidation: (...args: unknown[]) => useValidation(...args),
}));
vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: (...args: unknown[]) => useCurrentEnvironment(...args),
}));
vi.mock('@/react/portainer/environments/queries/useEnvironment', () => ({
  useEnvironmentDeploymentOptions: (...args: unknown[]) =>
    useEnvironmentDeploymentOptions(...args),
}));
vi.mock('./InnerForm', () => ({
  InnerForm: ({
    isEditorReadonly,
  }: {
    isEditorReadonly: boolean;
  }) => {
    const { useFormikContext } = require('formik') as typeof import('formik');
    const { submitForm, values } = useFormikContext<{ Title: string }>();
    return (
      <div>
        <div data-cy="readonly">{String(isEditorReadonly)}</div>
        <div data-cy="title">{values.Title}</div>
        <button type="button" onClick={() => submitForm()}>
          Submit
        </button>
      </div>
    );
  },
}));

const template = {
  Id: 7,
  Title: 'Nginx',
  Description: 'desc',
  Note: '',
  Logo: '',
  Platform: Platform.LINUX,
  Type: StackType.DockerCompose,
  Variables: [],
  ProjectPath: '',
  EntryPoint: '',
  CreatedByUserId: 1,
  IsComposeFormat: false,
};

describe('REQ-TPL-03 EditForm for local Compose templates', () => {
  beforeEach(() => {
    mutate.mockReset();
    go.mockReset();
    notifySuccess.mockReset();
    useInitialValues.mockReturnValue({
      Title: 'Nginx',
      Description: 'desc',
      Note: '',
      Logo: '',
      Platform: Platform.LINUX,
      Type: StackType.DockerCompose,
      FileContent: 'services: {}',
      Variables: [],
    });
    useCustomTemplateFile.mockReturnValue({
      data: 'services: {}',
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCurrentEnvironment.mockReturnValue({ data: undefined });
    useEnvironmentDeploymentOptions.mockReturnValue({ data: undefined });
  });

  it('returns null while the template file or initial values load', () => {
    useCustomTemplateFile.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container, rerender } = render(
      <EditForm template={template as never} viewType="docker" />
    );
    expect(container).toBeEmptyDOMElement();

    useCustomTemplateFile.mockReturnValue({
      data: 'services: {}',
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useInitialValues.mockReturnValue(undefined);
    rerender(
      <EditForm template={template as never} viewType="docker" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('submits an update for a local Compose template', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());

    render(
      <EditForm template={template as never} viewType="docker" />
    );

    expect(screen.getByTestId('title')).toHaveTextContent('Nginx');
    expect(screen.getByTestId('readonly')).toHaveTextContent('false');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        Title: 'Nginx',
        FileContent: 'services: {}',
        Type: StackType.DockerCompose,
      }),
      expect.any(Object)
    );
    expect(notifySuccess).toHaveBeenCalledWith(
      'Success',
      'Template updated successfully'
    );
    expect(go).toHaveBeenCalledWith('^');
  });

  it('marks the editor readonly for git-backed templates', () => {
    render(
      <EditForm
        template={{ ...template, GitConfig: { URL: 'git' } } as never}
        viewType="docker"
      />
    );
    expect(screen.getByTestId('readonly')).toHaveTextContent('true');
  });
});
