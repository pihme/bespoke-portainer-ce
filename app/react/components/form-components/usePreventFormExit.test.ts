import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const useTransitionHook = vi.fn();

vi.mock('@uirouter/react', () => ({
  useTransitionHook: (...args: unknown[]) => useTransitionHook(...args),
}));

vi.mock('@@/modals/confirm', () => ({
  confirmGenericDiscard: vi.fn(async () => true),
}));

import { usePreventFormExit } from './usePreventFormExit';

describe('usePreventFormExit', () => {
  beforeEach(() => {
    useTransitionHook.mockReset();
  });

  it('registers an onBefore transition hook and allows exit when unchanged', async () => {
    const confirmFn = vi.fn(async () => false);
    renderHook(() => usePreventFormExit(() => false, true, confirmFn));

    expect(useTransitionHook).toHaveBeenCalledWith(
      'onBefore',
      {},
      expect.any(Function)
    );

    const handler = useTransitionHook.mock.calls[0][2] as () => Promise<boolean>;
    await expect(handler()).resolves.toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('asks for confirmation when changed', async () => {
    const confirmFn = vi.fn(async () => true);
    renderHook(() => usePreventFormExit(() => true, true, confirmFn));
    const handler = useTransitionHook.mock.calls[0][2] as () => Promise<boolean>;
    await expect(handler()).resolves.toBe(true);
    expect(confirmFn).toHaveBeenCalled();
  });

  it('skips confirmation when check is false', async () => {
    const confirmFn = vi.fn(async () => false);
    renderHook(() => usePreventFormExit(() => true, false, confirmFn));
    const handler = useTransitionHook.mock.calls[0][2] as () => Promise<boolean>;
    await expect(handler()).resolves.toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('adds and removes beforeunload when dirty', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() =>
      usePreventFormExit(() => true, true, async () => true)
    );

    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const handler = add.mock.calls.find(
      (c) => c[0] === 'beforeunload'
    )?.[1] as (e: BeforeUnloadEvent) => string | undefined;

    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined as unknown,
    } as BeforeUnloadEvent;
    expect(handler(event)).toBe('');
    expect(event.preventDefault).toHaveBeenCalled();

    unmount();
    expect(remove).toHaveBeenCalledWith('beforeunload', handler);

    add.mockRestore();
    remove.mockRestore();
  });

  it('beforeunload returns undefined when not dirty', () => {
    const add = vi.spyOn(window, 'addEventListener');
    renderHook(() => usePreventFormExit(() => false, true, async () => true));
    const handler = add.mock.calls.find(
      (c) => c[0] === 'beforeunload'
    )?.[1] as (e: BeforeUnloadEvent) => string | undefined;
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined as unknown,
    } as BeforeUnloadEvent;
    expect(handler(event)).toBeUndefined();
    add.mockRestore();
  });
});
