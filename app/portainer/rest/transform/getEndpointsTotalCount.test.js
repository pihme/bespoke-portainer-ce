import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromJson = vi.fn((data) => JSON.parse(data));

vi.stubGlobal('angular', { fromJson });

const getEndpointsTotalCount = (await import('./getEndpointsTotalCount.js')).default;

describe('REQ-ENV-01 getEndpointsTotalCount', () => {
  beforeEach(() => {
    fromJson.mockClear();
  });

  it('parses the body and reads X-Total-Count', () => {
    const headers = vi.fn((name) => (name === 'X-Total-Count' ? '42' : null));
    const result = getEndpointsTotalCount('[{"Id":1}]', headers);

    expect(fromJson).toHaveBeenCalledWith('[{"Id":1}]');
    expect(result).toEqual({ value: [{ Id: 1 }], totalCount: '42' });
    expect(headers).toHaveBeenCalledWith('X-Total-Count');
  });
});
