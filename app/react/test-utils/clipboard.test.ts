import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockClipboard } from './clipboard';

describe('mockClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stubs isSecureContext and navigator.clipboard.writeText', async () => {
    const { writeText } = mockClipboard();
    expect(globalThis.isSecureContext).toBe(true);
    await navigator.clipboard.writeText('copied');
    expect(writeText).toHaveBeenCalledWith('copied');
  });
});
