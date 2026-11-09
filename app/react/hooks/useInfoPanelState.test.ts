import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach } from 'vitest';

import { useInfoPanelState } from './useInfoPanelState';
import { useUIState } from './useUIState';

describe('useInfoPanelState', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIState.setState({
      dismissedInfoPanels: {},
      dismissedInfoHash: '',
      dismissedUpdateVersion: '',
    });
  });

  it('is visible until dismissed', () => {
    const { result } = renderHook(() => useInfoPanelState('tips'));

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isVisible).toBe(false);
    expect(useUIState.getState().dismissedInfoPanels.tips).toBe(true);
  });

  it('starts hidden when the panel was already dismissed', () => {
    useUIState.setState({
      dismissedInfoPanels: { tips: true },
      dismissedInfoHash: '',
      dismissedUpdateVersion: '',
    });

    const { result } = renderHook(() => useInfoPanelState('tips'));
    expect(result.current.isVisible).toBe(false);
  });
});
