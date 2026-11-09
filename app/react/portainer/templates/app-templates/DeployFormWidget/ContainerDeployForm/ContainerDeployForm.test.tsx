import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplateType } from '../../types';
import { TemplateViewModel } from '../../view-model';

import { ContainerDeployForm } from './ContainerDeployForm';

const onSubmit = vi.fn();
const useCreate = vi.fn(() => ({ onSubmit, isLoading: false }));
const useValidation = vi.fn(() => undefined);

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 3,
}));
vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: () => ({ user: { Id: 1 } }),
  useIsEdgeAdmin: () => ({ isAdmin: true, isLoading: false }),
}));
vi.mock('@/react/portainer/access-control/utils', () => ({
  parseAccessControlFormData: () => ({ AccessControlEnabled: false }),
}));
vi.mock('@/react/portainer/access-control', () => ({
  AccessControlForm: () => <div>access-control</div>,
}));
vi.mock('@/react/docker/containers/CreateView/BaseForm/NameField', () => ({
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
vi.mock('@/react/docker/containers/components/NetworkSelector', () => ({
  NetworkSelector: () => <div>network-selector</div>,
}));
vi.mock('@/react/docker/containers/CreateView/BaseForm/PortsMappingField', () => ({
  PortsMappingField: () => <div>ports</div>,
}));
vi.mock('@/react/docker/containers/CreateView/VolumesTab', () => ({
  VolumesTab: () => <div>volumes</div>,
}));
vi.mock('@/react/docker/containers/CreateView/NetworkTab/HostsFileEntries', () => ({
  HostsFileEntries: () => <div>hosts</div>,
}));
vi.mock('@/react/docker/containers/CreateView/LabelsTab', () => ({
  LabelsTab: () => <div>labels</div>,
}));
vi.mock('@/react/docker/containers/CreateView/NetworkTab/HostnameField', () => ({
  HostnameField: () => <div>hostname</div>,
}));
vi.mock('../EnvVarsFieldset', () => ({
  EnvVarsFieldset: () => <div>env-vars</div>,
}));
vi.mock('./useCreate', () => ({
  useCreate: (...args: unknown[]) => useCreate(...args),
}));
vi.mock('./useValidation', () => ({
  useValidation: (...args: unknown[]) => useValidation(...args),
}));

function template(): TemplateViewModel {
  return {
    Id: 1,
    Title: 'Nginx',
    Name: 'web',
    Type: TemplateType.Container,
    Env: [{ name: 'FOO', label: 'Foo', value: 'bar', type: 2 }],
    Ports: [{ hostPort: '8080', containerPort: '80', protocol: 'tcp' }],
    Volumes: [
      { container: '/data', type: 'auto', bind: null, readonly: false },
      { container: '/etc', type: 'bind', bind: '/host/etc', readonly: true },
    ],
  } as TemplateViewModel;
}

describe('REQ-TPL-01 ContainerDeployForm', () => {
  beforeEach(() => {
    onSubmit.mockReset();
    useCreate.mockReturnValue({ onSubmit, isLoading: false });
  });

  it('returns null while create mutation is unavailable', () => {
    useCreate.mockReturnValue(null);
    const { container } = render(
      <ContainerDeployForm template={template()} unselect={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the deploy form and hides on cancel', async () => {
    const user = userEvent.setup();
    const unselect = vi.fn();
    render(<ContainerDeployForm template={template()} unselect={unselect} />);

    expect(screen.getByLabelText('Name')).toHaveValue('web');
    expect(screen.getByText('env-vars')).toBeVisible();
    expect(screen.getByText('access-control')).toBeVisible();
    expect(screen.getByText('Show advanced options')).toBeVisible();

    await user.click(screen.getByText('Show advanced options'));
    expect(screen.getByText('ports')).toBeVisible();
    expect(screen.getByText('volumes')).toBeVisible();
    expect(screen.getByText('hosts')).toBeVisible();
    expect(screen.getByText('labels')).toBeVisible();
    expect(screen.getByText('hostname')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(unselect).toHaveBeenCalled();
  });
});
