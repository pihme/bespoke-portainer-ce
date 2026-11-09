import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TableSettingsProvider, useTableSettings } from './useTableSettings';

type Settings = {
  pageSize: number;
  setPageSize: (pageSize: number) => void;
};

function Consumer() {
  const settings = useTableSettings<Settings>();
  return (
    <button
      type="button"
      data-cy="bump-page-size"
      onClick={() => settings.setPageSize(settings.pageSize + 1)}
    >
      {settings.pageSize}
    </button>
  );
}

describe('useTableSettings (backwards compatibility)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('throws when used outside TableSettingsProvider', () => {
    expect(() => render(<Consumer />)).toThrow(
      /must be nested under TableSettingsProvider/
    );
  });

  it('exposes the zustand store value and updates through setters', async () => {
    const user = userEvent.setup();
    const store = createStore<Settings>()((set) => ({
      pageSize: 10,
      setPageSize: (pageSize) => set({ pageSize }),
    }));

    render(
      <TableSettingsProvider settings={store}>
        <Consumer />
      </TableSettingsProvider>
    );

    expect(screen.getByRole('button')).toHaveTextContent('10');
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('11');
  });
});
