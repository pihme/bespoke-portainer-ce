import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromJson = vi.fn((data) => JSON.parse(data));
vi.stubGlobal('angular', { fromJson });

const gitlabResponseGetLink = (await import('./gitlabResponseGetLink.js'))
  .default;

describe('gitlabResponseGetLink', () => {
  beforeEach(() => {
    fromJson.mockClear();
  });

  it('parses JSON body and reads X-Next-Page', () => {
    const headers = vi.fn((name) => (name === 'X-Next-Page' ? '3' : null));
    expect(gitlabResponseGetLink('{"ok":true}', headers)).toEqual({
      data: { ok: true },
      next: '3',
    });
  });

  it('returns raw data when JSON parsing fails', () => {
    fromJson.mockImplementationOnce(() => {
      throw new Error('bad json');
    });
    const headers = vi.fn();
    expect(gitlabResponseGetLink('not-json', headers)).toBe('not-json');
  });
});
