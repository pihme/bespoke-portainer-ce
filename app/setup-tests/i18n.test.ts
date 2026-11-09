import { describe, expect, it } from 'vitest';

import i18n from './i18n';

describe('setup-tests i18n (backwards compatibility)', () => {
  it('initializes English translations namespace', async () => {
    await i18n.loadLanguages('en');
    expect(i18n.language).toMatch(/en/);
    expect(i18n.options.defaultNS).toBe('translationsNS');
  });
});
