import { describe, expect, it, vi, beforeEach } from 'vitest';

import { getGroup, getGroups } from './environment-groups.service';

const axiosGet = vi.hoisted(() => vi.fn());

vi.mock('@/portainer/services/axios/axios', () => ({
  default: { get: axiosGet },
  parseAxiosError: (e: unknown, msg: string) => {
    const err = new Error(msg);
    (err as Error & { cause?: unknown }).cause = e;
    return err;
  },
}));

vi.mock('./queries/build-url', () => ({
  buildUrl: (id?: number) =>
    id ? `/api/endpoint_groups/${id}` : '/api/endpoint_groups',
}));

describe('environment-groups.service', () => {
  beforeEach(() => axiosGet.mockReset());

  it('fetches one group and all groups', async () => {
    axiosGet.mockResolvedValueOnce({ data: { Id: 2, Name: 'g' } });
    await expect(getGroup(2)).resolves.toEqual({ Id: 2, Name: 'g' });
    expect(axiosGet).toHaveBeenCalledWith('/api/endpoint_groups/2');

    axiosGet.mockResolvedValueOnce({ data: [{ Id: 1, Name: 'Unassigned' }] });
    await expect(getGroups()).resolves.toEqual([
      { Id: 1, Name: 'Unassigned' },
    ]);
  });

  it('wraps failures with parseAxiosError', async () => {
    axiosGet.mockRejectedValueOnce(new Error('boom'));
    await expect(getGroup(9)).rejects.toThrow('Unable to retrieve group');
    axiosGet.mockRejectedValueOnce(new Error('boom'));
    await expect(getGroups()).rejects.toThrow('Unable to retrieve groups');
  });
});
