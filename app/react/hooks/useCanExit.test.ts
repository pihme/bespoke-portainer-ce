import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useParentView = vi.fn();
const useTransitionHook = vi.fn();

vi.mock('@uirouter/react', () => ({
  useParentView: () => useParentView(),
  useTransitionHook: (...args: unknown[]) => useTransitionHook(...args),
}));

import { useCanExit } from './useCanExit';

describe('useCanExit', () => {
  beforeEach(() => {
    useParentView.mockReset();
    useTransitionHook.mockReset();
    useParentView.mockReturnValue({ context: { name: 'docker.containers' } });
  });

  it('registers an onBefore transition hook for the parent state', () => {
    const canExit = vi.fn(() => true);

    renderHook(() => useCanExit(canExit));

    expect(useTransitionHook).toHaveBeenCalledWith(
      'onBefore',
      { exiting: 'docker.containers' },
      canExit
    );
  });
});
