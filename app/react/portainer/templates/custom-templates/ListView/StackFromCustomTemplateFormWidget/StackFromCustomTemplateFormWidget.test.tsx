import { render, screen } from '@testing-library/react';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { StackFromCustomTemplateFormWidget } from './StackFromCustomTemplateFormWidget';
import type { CustomTemplate } from '@/react/portainer/templates/custom-templates/types';

const useCustomTemplate = vi.fn();
const useCustomTemplateFile = vi.fn();
const useIsDeployable = vi.fn();

vi.mock('@/react/portainer/templates/custom-templates/queries/useCustomTemplate', () => ({
  useCustomTemplate: (...args: unknown[]) => useCustomTemplate(...args),
}));
vi.mock('@/react/portainer/templates/custom-templates/queries/useCustomTemplateFile', () => ({
  useCustomTemplateFile: (...args: unknown[]) => useCustomTemplateFile(...args),
}));
vi.mock('./useIsDeployable', () => ({
  useIsDeployable: (...args: unknown[]) => useIsDeployable(...args),
}));
vi.mock('@/react/portainer/templates/components/DeployWidget', () => ({
  DeployWidget: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock('./DeployForm', () => ({
  DeployForm: ({
    template,
    templateFile,
  }: {
    template: CustomTemplate;
    templateFile: string;
  }) => (
    <div data-cy="deploy-form">
      {template.Title}:{templateFile}
    </div>
  ),
}));
vi.mock('./TemplateLoadError', () => ({
  TemplateLoadError: () => <div data-cy="template-load-error">load-error</div>,
}));
vi.mock('@@/Tip/TextTip', () => ({
  TextTip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function template(overrides: Partial<CustomTemplate> = {}): CustomTemplate {
  return {
    Id: 7,
    Title: 'Nginx',
    Description: 'web',
    ProjectPath: '/data/custom_template/7',
    EntryPoint: 'docker-compose.yml',
    CreatedByUserId: 1,
    Note: 'note',
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    Variables: [],
    IsComposeFormat: false,
    ...overrides,
  };
}

describe('REQ-TPL-03 StackFromCustomTemplateFormWidget for local Compose', () => {
  beforeEach(() => {
    useCustomTemplate.mockReset();
    useCustomTemplateFile.mockReset();
    useIsDeployable.mockReset();
    useIsDeployable.mockReturnValue(true);
  });

  it('returns null while the template file is loading', () => {
    useCustomTemplate.mockReturnValue({ data: template() });
    useCustomTemplateFile.mockReturnValue({
      isLoading: true,
      isError: false,
      isSuccess: false,
      data: undefined,
    });

    const { container } = render(
      <StackFromCustomTemplateFormWidget templateId={7} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when the template is missing', () => {
    useCustomTemplate.mockReturnValue({ data: undefined });
    useCustomTemplateFile.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: 'services: {}',
    });

    const { container } = render(
      <StackFromCustomTemplateFormWidget templateId={7} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a load error when the template file fails', () => {
    useCustomTemplate.mockReturnValue({ data: template() });
    useCustomTemplateFile.mockReturnValue({
      isLoading: false,
      isError: true,
      isSuccess: false,
      data: undefined,
    });

    render(<StackFromCustomTemplateFormWidget templateId={7} />);
    expect(screen.getByText('Nginx')).toBeVisible();
    expect(screen.getByTestId('template-load-error')).toBeVisible();
  });

  it('shows a tip when the template type is not deployable here', () => {
    useIsDeployable.mockReturnValue(false);
    useCustomTemplate.mockReturnValue({ data: template() });
    useCustomTemplateFile.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: 'services: {}',
    });

    render(<StackFromCustomTemplateFormWidget templateId={7} />);
    expect(
      screen.getByText(
        'This template type cannot be deployed on this environment.'
      )
    ).toBeVisible();
    expect(screen.queryByTestId('deploy-form')).toBeNull();
  });

  it('renders DeployForm for a deployable local Compose template', () => {
    useCustomTemplate.mockReturnValue({ data: template() });
    useCustomTemplateFile.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: 'services: {}',
    });

    render(<StackFromCustomTemplateFormWidget templateId={7} />);
    expect(screen.getByTestId('deploy-form')).toHaveTextContent(
      'Nginx:services: {}'
    );
  });
});
