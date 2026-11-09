import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockUser } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { Role } from '@/portainer/users/types';
import { SourceDetail } from '../queries/useSource';

import { ItemView } from './ItemView';

const sourceState: {
  data: SourceDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
};

let currentTabParam = 'settings';

vi.mock('@/react/hooks/useIdParam', () => ({
  useIdParam: () => 12,
}));

vi.mock('../queries/useSource', () => ({
  useSource: () => sourceState,
}));

vi.mock('@@/Widget/WidgetTabs', () => ({
  WidgetTabs: ({
    tabs,
    currentTabIndex,
  }: {
    tabs: Array<{ name: React.ReactNode; selectedTabParam: string }>;
    currentTabIndex: number;
  }) => (
    <nav aria-label="Section navigation">
      {tabs.map((tab, index) => (
        <span
          key={tab.selectedTabParam}
          data-cy={`tab-${index}`}
          aria-current={currentTabIndex === index ? 'page' : undefined}
        >
          {tab.name}
        </span>
      ))}
    </nav>
  ),
  useCurrentTabIndex: (tabs: Array<{ selectedTabParam: string }>) => {
    const idx = tabs.findIndex((t) => t.selectedTabParam === currentTabParam);
    return idx === -1 ? 0 : idx;
  },
}));

vi.mock('./SettingsTab/SettingsTab', () => ({
  SettingsTab: ({
    isEditing,
  }: {
    source: SourceDetail;
    isEditing: boolean;
    onEditingChange: (v: boolean) => void;
  }) => (
    <div data-cy="settings-tab">Settings {isEditing ? 'edit' : 'view'}</div>
  ),
}));

vi.mock('./WorkflowsTab', () => ({
  WorkflowsTab: () => <div data-cy="workflows-tab">Workflows body</div>,
}));

vi.mock('./AccessTab', () => ({
  AccessTab: () => <div data-cy="access-tab">Access body</div>,
}));

vi.mock('./SourceResourceHeader', () => ({
  SourceResourceHeader: ({ source }: { source: SourceDetail }) => (
    <div data-cy="source-header">{source.name}</div>
  ),
}));

vi.mock('./WorkflowsCountDot', () => ({
  WorkflowsCountDot: () => <span data-cy="workflows-dot">0</span>,
}));

const source: SourceDetail = {
  id: 12,
  name: 'item-source',
  type: 'git',
  url: 'https://github.com/org/item.git',
  status: 'healthy',
  connection: {},
};

function renderView(role: Role = Role.Admin) {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ItemView), createMockUser({ Role: role }))
  );
  return render(<Wrapped />);
}

describe('REQ-GIT-01 ItemView', () => {
  beforeEach(() => {
    sourceState.data = source;
    sourceState.isLoading = false;
    sourceState.isError = false;
    sourceState.error = null;
    currentTabParam = 'settings';
  });

  it('TestREQ_GIT_01_shows_skeleton_while_source_loads', () => {
    sourceState.isLoading = true;
    sourceState.data = undefined;
    renderView();

    expect(screen.getByText('GitOps Sources')).toBeVisible();
    expect(screen.queryByTestId('source-header')).not.toBeInTheDocument();
  });

  it('TestREQ_GIT_01_shows_error_alert_when_source_fails_to_load', () => {
    sourceState.isError = true;
    sourceState.data = undefined;
    sourceState.error = new Error('boom');
    renderView();

    expect(screen.getByText(/Failed loading source:\s*boom/)).toBeVisible();
  });

  it('TestREQ_GIT_01_shows_unknown_error_when_error_is_not_an_Error', () => {
    sourceState.isError = true;
    sourceState.data = undefined;
    sourceState.error = 'nope' as unknown as Error;
    renderView();

    expect(
      screen.getByText(/Failed loading source:\s*Unknown error/)
    ).toBeVisible();
  });

  it('TestREQ_GIT_01_renders_settings_tab_by_default_with_edit_control', async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.getByTestId('source-header')).toHaveTextContent('item-source');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent(
      'Settings view'
    );
    expect(screen.getByTestId('edit-settings-button')).toBeVisible();

    await user.click(screen.getByTestId('edit-settings-button'));

    expect(screen.getByText('Editing')).toBeVisible();
    expect(screen.getByTestId('settings-tab')).toHaveTextContent(
      'Settings edit'
    );
  });

  it('TestREQ_GIT_01_shows_workflows_tab_body_when_workflows_selected', () => {
    currentTabParam = 'workflows';
    renderView();

    expect(screen.getByTestId('workflows-tab')).toBeVisible();
    expect(
      screen.queryByTestId('edit-settings-button')
    ).not.toBeInTheDocument();
  });

  it('TestREQ_GIT_01_hides_access_edit_for_non_admin', () => {
    currentTabParam = 'accessTab';
    renderView(Role.Standard);

    expect(screen.getByTestId('access-tab')).toBeVisible();
    expect(
      screen.queryByTestId('edit-settings-button')
    ).not.toBeInTheDocument();
  });

  it('TestREQ_GIT_01_allows_access_edit_for_admin', () => {
    currentTabParam = 'accessTab';
    renderView(Role.Admin);

    expect(screen.getByTestId('access-tab')).toBeVisible();
    expect(screen.getByTestId('edit-settings-button')).toBeVisible();
  });
});
