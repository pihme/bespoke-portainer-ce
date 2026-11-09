import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  EnvironmentStatus,
  EnvironmentType,
} from '@/react/portainer/environments/types';

import { columns } from './index';
import { name } from './name';
import { type } from './type';
import { url } from './url';
import { actions } from './actions';
import { columnHelper } from './helper';

vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@@/Icon', () => ({
  Icon: () => <span data-cy="icon" />,
}));
vi.mock('@/react/portainer/environments/utils', () => ({
  getEnvironmentTypeIcon: () => 'box',
  getPlatformTypeName: () => 'Docker',
}));
vi.mock('../../queries/useUpdateEnvironmentMutation', () => ({
  useUpdateEnvironmentMutation: () => ({
    mutate: mockMutate,
  }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args),
}));
vi.mock('@@/Tip/TooltipWithChildren', () => ({
  TooltipWithChildren: ({
    children,
    message,
  }: {
    children: React.ReactNode;
    message: React.ReactNode;
  }) => (
    <div>
      {children}
      <div data-cy="tooltip">{message}</div>
    </div>
  ),
}));
vi.mock('@@/Tip/Tooltip', () => ({
  Tooltip: () => null,
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

const mockMutate = vi.fn();
const mockNotifySuccess = vi.fn();

function env(overrides: Record<string, unknown> = {}) {
  return {
    Id: 1,
    Name: 'local',
    URL: 'unix:///var/run/docker.sock',
    Type: EnvironmentType.Docker,
    Status: EnvironmentStatus.Up,
    GroupName: 'default',
    ...overrides,
  };
}

function renderCell(
  column: { cell?: unknown },
  environment: ReturnType<typeof env>,
  value?: unknown
) {
  const Cell = column.cell as (ctx: unknown) => React.ReactNode;
  return render(
    <>
      {Cell({
        getValue: () => value ?? environment.Name,
        row: { original: environment },
      })}
    </>
  );
}

describe('REQ-ENV-03 environment list columns for local Docker', () => {
  it('exports the expected column set including helper', () => {
    expect(columns.map((c) => c.id || c.header)).toEqual(
      expect.arrayContaining(['Name', 'Type', 'URL', 'Actions'])
    );
    expect(columnHelper).toBeTruthy();
  });

  it('links active environment names and plain-texts provisioning ones', () => {
    const { rerender } = renderCell(name, env());
    expect(screen.getByText('local').closest('a')).toBeTruthy();

    rerender(
      <>
        {(name.cell as (ctx: unknown) => React.ReactNode)({
          getValue: () => 'provisioning',
          row: {
            original: env({ Status: EnvironmentStatus.Provisioning }),
          },
        })}
      </>
    );
    expect(screen.getByText('provisioning').closest('a')).toBeNull();
  });

  it('renders the Docker type label', () => {
    renderCell(type, env(), {
      type: EnvironmentType.Docker,
      containerEngine: undefined,
    });
    expect(screen.getByText('Docker')).toBeVisible();
  });

  it('builds the type accessor from the environment row', () => {
    const accessor = type.accessorFn as (row: ReturnType<typeof env>) => {
      type: EnvironmentType;
      containerEngine?: unknown;
    };
    expect(accessor(env({ Type: EnvironmentType.Docker }))).toEqual({
      type: EnvironmentType.Docker,
      containerEngine: undefined,
    });
  });

  it('shows the local URL and can dismiss a status error', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());
    renderCell(
      url,
      env({
        StatusMessage: { summary: 'broken', detail: 'socket missing' },
      })
    );
    expect(screen.getByText('unix:///var/run/docker.sock')).toBeVisible();
    expect(screen.getByText('broken')).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: /Dismiss error/,
      })
    );
    expect(mockMutate).toHaveBeenCalled();
    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'Success',
      'Error dismissed successfully'
    );
  });

  it('renders a local URL without a status message', () => {
    renderCell(url, env({ StatusMessage: undefined }));
    expect(screen.getByText('unix:///var/run/docker.sock')).toBeVisible();
  });

  it('shows a provisioning spinner and summary in the URL cell', () => {
    renderCell(
      url,
      env({
        Status: EnvironmentStatus.Provisioning,
        StatusMessage: { summary: 'creating', detail: 'almost done' },
        URL: '',
      })
    );
    expect(screen.getByText('creating')).toBeVisible();
  });

  it('hides manage-access for provisioning environments', () => {
    renderCell(actions, env({ Status: EnvironmentStatus.Provisioning }));
    expect(screen.getByText('-')).toBeVisible();
  });

  it('hides manage access for environments in error', () => {
    renderCell(actions, env({ Status: EnvironmentStatus.Error }));
    expect(screen.getByText('-')).toBeVisible();
  });

  it('shows manage access for an active local environment', () => {
    renderCell(actions, env({ Status: EnvironmentStatus.Up }));
    expect(screen.getByText('Manage access')).toBeVisible();
  });
});
