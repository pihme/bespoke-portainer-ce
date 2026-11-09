import { render, screen } from '@testing-library/react';

import { TemplateType } from '../types';
import { TemplateViewModel } from '../view-model';

import { DeployForm } from './DeployFormWidget';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: vi.fn(),
}));

vi.mock('./ContainerDeployForm/ContainerDeployForm', () => ({
  ContainerDeployForm: () => <div>container-deploy-form</div>,
}));

vi.mock('./StackDeployForm/StackDeployForm', () => ({
  StackDeployForm: () => <div>stack-deploy-form</div>,
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
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';

function template(type: TemplateType): TemplateViewModel {
  return {
    Id: 1,
    Title: 'Demo',
    Logo: undefined,
    Note: 'note',
    Type: type,
  } as TemplateViewModel;
}

describe('REQ-TPL-01 DeployForm widget routing', () => {
  beforeEach(() => {
    vi.mocked(useEnvironmentId).mockReset();
  });

  it('renders the container deploy form for container templates', () => {
    vi.mocked(useEnvironmentId).mockReturnValue(3);
    render(<DeployForm template={template(TemplateType.Container)} unselect={vi.fn()} />);
    expect(screen.getByText('Demo')).toBeVisible();
    expect(screen.getByText('container-deploy-form')).toBeVisible();
  });

  it('renders the stack deploy form for compose templates', () => {
    vi.mocked(useEnvironmentId).mockReturnValue(3);
    render(
      <DeployForm template={template(TemplateType.ComposeStack)} unselect={vi.fn()} />
    );
    expect(screen.getByText('stack-deploy-form')).toBeVisible();
  });

  it('renders an empty form for edge templates without an environment', () => {
    vi.mocked(useEnvironmentId).mockReturnValue(undefined as unknown as number);
    const { container } = render(
      <DeployForm template={template(TemplateType.ComposeStack)} unselect={vi.fn()} />
    );
    expect(screen.getByText('Demo')).toBeVisible();
    expect(container.querySelector('h2')?.nextSibling).toBeNull();
  });
});
