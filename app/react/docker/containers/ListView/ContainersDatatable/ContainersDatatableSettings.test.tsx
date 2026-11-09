import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ContainersDatatableSettings } from './ContainersDatatableSettings';
import { TRUNCATE_LENGTH } from './datatable-store';
import { TableSettings } from './types';

function createSettings(
  overrides: Partial<TableSettings> = {}
): TableSettings {
  return {
    pageSize: 10,
    setPageSize: vi.fn(),
    sortBy: { id: 'name', desc: false },
    setSortBy: vi.fn(),
    hiddenColumns: [],
    setHiddenColumns: vi.fn(),
    autoRefreshRateMS: 0,
    setAutoRefreshRate: vi.fn(),
    columnFilters: [],
    setColumnFilters: vi.fn(),
    truncateContainerName: TRUNCATE_LENGTH,
    setTruncateContainerName: vi.fn(),
    hiddenQuickActions: [],
    setHiddenQuickActions: vi.fn(),
    ...overrides,
  };
}

describe('REQ-CTR-01 ContainersDatatableSettings', () => {
  it('shows truncate checkbox checked when truncate length is positive', () => {
    render(
      <ContainersDatatableSettings settings={createSettings()} />
    );

    expect(
      screen.getByTestId('settings-container-truncate-name')
    ).toBeChecked();
  });

  it('toggles truncate off when checked and clicked', async () => {
    const user = userEvent.setup();
    const setTruncateContainerName = vi.fn();
    render(
      <ContainersDatatableSettings
        settings={createSettings({ setTruncateContainerName })}
      />
    );

    await user.click(screen.getByTestId('settings-container-truncate-name'));

    expect(setTruncateContainerName).toHaveBeenCalledWith(0);
  });

  it('toggles truncate on when unchecked and clicked', async () => {
    const user = userEvent.setup();
    const setTruncateContainerName = vi.fn();
    render(
      <ContainersDatatableSettings
        settings={createSettings({
          truncateContainerName: 0,
          setTruncateContainerName,
        })}
      />
    );

    await user.click(screen.getByTestId('settings-container-truncate-name'));

    expect(setTruncateContainerName).toHaveBeenCalledWith(TRUNCATE_LENGTH);
  });

  it('shows auto-refresh controls when isRefreshVisible', () => {
    render(
      <ContainersDatatableSettings
        isRefreshVisible
        settings={createSettings({ autoRefreshRateMS: 10000 })}
      />
    );

    expect(screen.getByTestId('settings-auto-refresh')).toBeInTheDocument();
  });

  it('hides auto-refresh controls when isRefreshVisible is false', () => {
    render(
      <ContainersDatatableSettings
        isRefreshVisible={false}
        settings={createSettings()}
      />
    );

    expect(
      screen.queryByTestId('settings-auto-refresh')
    ).not.toBeInTheDocument();
  });

  it('updates auto-refresh rate when toggled on', async () => {
    const user = userEvent.setup();
    const setAutoRefreshRate = vi.fn();
    render(
      <ContainersDatatableSettings
        isRefreshVisible
        settings={createSettings({
          autoRefreshRateMS: 0,
          setAutoRefreshRate,
        })}
      />
    );

    await user.click(screen.getByTestId('settings-auto-refresh'));

    expect(setAutoRefreshRate).toHaveBeenCalled();
  });
});
