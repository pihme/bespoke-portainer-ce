import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

import { useCachedValidation } from './useCachedTest';

describe('useCachedValidation', () => {
  it('caches the async result until the value changes', async () => {
    const asyncValidate = vi.fn(async (value: string) => value === 'ok');
    const { result } = renderHook(() => useCachedValidation(asyncValidate));

    await expect(result.current('ok', {} as never)).resolves.toBe(true);
    await expect(result.current('ok', {} as never)).resolves.toBe(true);
    expect(asyncValidate).toHaveBeenCalledTimes(1);

    await expect(result.current('bad', {} as never)).resolves.toBe(false);
    expect(asyncValidate).toHaveBeenCalledTimes(2);
  });
});
