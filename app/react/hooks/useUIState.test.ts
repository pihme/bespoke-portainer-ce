import { describe, it, expect, beforeEach } from 'vitest';

import { keyBuilder } from './useLocalStorage';
import { useUIState } from './useUIState';

describe('useUIState', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIState.setState({
      dismissedInfoPanels: {},
      dismissedInfoHash: '',
      dismissedUpdateVersion: '',
    });
  });

  it('dismisses info panels, motd hash and update version', () => {
    useUIState.getState().dismissInfoPanel('welcome');
    useUIState.getState().dismissMotd('hash-1');
    useUIState.getState().dismissUpdateVersion('2.45.0');

    const state = useUIState.getState();
    expect(state.dismissedInfoPanels.welcome).toBe(true);
    expect(state.dismissedInfoHash).toBe('hash-1');
    expect(state.dismissedUpdateVersion).toBe('2.45.0');
  });

  it('persists state under the portainer-prefixed key', () => {
    useUIState.getState().dismissInfoPanel('panel-a');

    const raw = localStorage.getItem(keyBuilder('NEW_UI_STATE'));
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.dismissedInfoPanels['panel-a']).toBe(true);
  });
});
