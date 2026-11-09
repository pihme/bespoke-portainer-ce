import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand';
import { describe, expect, it } from 'vitest';

import { QuickAction } from '@/react/docker/containers/ListView/ContainersDatatable/types';

import { TableSettingsProvider } from './useTableSettings';
import {
  Action,
  QuickActionsSettings,
  buildAction,
} from './QuickActionsSettings';

type Settings = {
  hiddenQuickActions: QuickAction[];
  setHiddenQuickActions: (hiddenQuickActions: QuickAction[]) => void;
};

const actions: Action[] = [
  buildAction('logs', 'Logs'),
  buildAction('inspect', 'Inspect'),
];

describe('QuickActionsSettings (backwards compatibility)', () => {
  it('buildAction returns the id and label pair', () => {
    expect(buildAction('exec', 'Console')).toEqual({
      id: 'exec',
      label: 'Console',
    });
  });

  it('toggles actions into and out of the hidden list', async () => {
    const user = userEvent.setup();
    const store = createStore<Settings>()((set) => ({
      hiddenQuickActions: [],
      setHiddenQuickActions: (hiddenQuickActions) =>
        set({ hiddenQuickActions }),
    }));

    render(
      <TableSettingsProvider settings={store}>
        <QuickActionsSettings actions={actions} />
      </TableSettingsProvider>
    );

    expect(screen.getByLabelText('Logs')).toBeChecked();
    await user.click(screen.getByLabelText('Logs'));
    expect(store.getState().hiddenQuickActions).toEqual(['logs']);

    await user.click(screen.getByLabelText('Logs'));
    expect(store.getState().hiddenQuickActions).toEqual([]);
  });
});
