import { render, screen } from '@testing-library/react';

import { TemplateType } from './types';
import { TemplateViewModel } from './view-model';
import { AppTemplatesView } from './AppTemplatesView';

const useEnvironmentId = vi.fn();
const useParamState = vi.fn();
const useAuthorizations = vi.fn();
const useAppTemplates = vi.fn();
const useInfo = vi.fn();
const useApiVersion = vi.fn();

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: (...args: unknown[]) => useEnvironmentId(...args),
}));
vi.mock('@/react/hooks/useParamState', () => ({
  useParamState: (...args: unknown[]) => useParamState(...args),
}));
vi.mock('@/react/hooks/useUser', () => ({
  useAuthorizations: (...args: unknown[]) => useAuthorizations(...args),
}));
vi.mock('./queries/useAppTemplates', () => ({
  useAppTemplates: (...args: unknown[]) => useAppTemplates(...args),
}));
vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useInfo: (...args: unknown[]) => useInfo(...args),
}));
vi.mock('@/react/docker/proxy/queries/useVersion', () => ({
  useApiVersion: (...args: unknown[]) => useApiVersion(...args),
}));
vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('./AppTemplatesList', () => ({
  AppTemplatesList: (props: {
    storageKey: string;
    disabledTypes?: TemplateType[];
    onSelect?: (t: TemplateViewModel) => void;
    templateLinkParams?: unknown;
    selectedId?: number;
  }) => (
    <div
      data-cy="templates-list"
      data-storage={props.storageKey}
      data-disabled={(props.disabledTypes || []).join(',')}
      data-has-select={String(!!props.onSelect)}
      data-has-link={String(!!props.templateLinkParams)}
      data-selected={String(props.selectedId ?? '')}
    />
  ),
}));
vi.mock('./DeployFormWidget/DeployFormWidget', () => ({
  DeployForm: ({ template }: { template: TemplateViewModel }) => (
    <div data-cy="deploy-form">{template.Title}</div>
  ),
}));

function tpl(id: number, title: string): TemplateViewModel {
  return {
    Id: id,
    Title: title,
    Type: TemplateType.Container,
  } as TemplateViewModel;
}

describe('REQ-TPL-01 AppTemplatesView', () => {
  beforeEach(() => {
    useEnvironmentId.mockReturnValue(3);
    useParamState.mockReturnValue([undefined, vi.fn()]);
    useAuthorizations.mockReturnValue({ authorized: true });
    useAppTemplates.mockReturnValue({ data: [tpl(1, 'Nginx'), tpl(2, 'Redis')] });
    useInfo.mockReturnValue({ data: undefined });
    useApiVersion.mockReturnValue(1.24);
  });

  it('renders the list for a local Docker environment without swarm stacks', () => {
    render(<AppTemplatesView />);

    expect(
      screen.getByRole('heading', { name: 'Application templates list' })
    ).toBeVisible();
    const list = screen.getByTestId('templates-list');
    expect(list).toHaveAttribute('data-storage', 'docker-app-templates');
    expect(list).toHaveAttribute(
      'data-disabled',
      String(TemplateType.SwarmStack)
    );
    expect(list).toHaveAttribute('data-has-select', 'true');
    expect(list).toHaveAttribute('data-has-link', 'false');
    expect(screen.queryByTestId('deploy-form')).not.toBeInTheDocument();
  });

  it('shows the deploy form when a template is selected', () => {
    useParamState.mockReturnValue([1, vi.fn()]);
    render(<AppTemplatesView />);
    expect(screen.getByTestId('deploy-form')).toHaveTextContent('Nginx');
  });

  it('enables swarm stack templates on a swarm manager', () => {
    useApiVersion.mockReturnValue(1.25);
    useInfo.mockReturnValue({
      data: { Swarm: { NodeID: 'node-1', ControlAvailable: true } },
    });

    render(<AppTemplatesView />);
    expect(screen.getByTestId('templates-list')).toHaveAttribute(
      'data-disabled',
      ''
    );
  });

  it('disables selection when create authorization is missing', () => {
    useAuthorizations.mockReturnValue({ authorized: false });
    render(<AppTemplatesView />);
    expect(screen.getByTestId('templates-list')).toHaveAttribute(
      'data-has-select',
      'false'
    );
  });

  it('uses edge list settings when no environment id is present', () => {
    // deferred-within-package edge path — still assert the filter wiring that
    // the view owns so the local docker/edge branch stays covered.
    useEnvironmentId.mockReturnValue(undefined);
    render(<AppTemplatesView />);
    const list = screen.getByTestId('templates-list');
    expect(list).toHaveAttribute('data-storage', 'edge-app-templates');
    expect(list).toHaveAttribute(
      'data-disabled',
      String(TemplateType.Container)
    );
    expect(list).toHaveAttribute('data-has-link', 'true');
    expect(list).toHaveAttribute('data-has-select', 'false');
  });
});
