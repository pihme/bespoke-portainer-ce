import { describe, expect, it, vi } from 'vitest';

import { suppressConsoleLogs } from './suppress-console';

describe('suppressConsoleLogs (backwards compatibility)', () => {
  it('suppresses console methods and restores them', () => {
    const restore = suppressConsoleLogs();
    console.error('hidden-error');
    console.warn('hidden-warn');
    console.info('hidden-info');
    console.log('hidden-log');

    expect(console.error).toHaveBeenCalledWith('hidden-error');
    expect(console.warn).toHaveBeenCalledWith('hidden-warn');
    expect(console.info).toHaveBeenCalledWith('hidden-info');
    expect(console.log).toHaveBeenCalledWith('hidden-log');

    restore();
    expect(vi.isMockFunction(console.error)).toBe(false);
  });
});
