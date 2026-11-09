import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, parseAxiosError } = vi.hoisted(() => ({
  get: vi.fn(),
  parseAxiosError: vi.fn((e: unknown, msg: string) => new Error(msg)),
}));

vi.mock('@/portainer/services/axios/axios', () => ({
  default: { get },
  parseAxiosError: (e: unknown, msg: string) => parseAxiosError(e, msg),
}));

import { getStackImagesStatus } from './getStackImagesStatus';

describe('getStackImagesStatus', () => {
  beforeEach(() => {
    get.mockReset();
    parseAxiosError.mockClear();
  });

  it('returns image status for a stack', async () => {
    get.mockResolvedValue({ data: { Status: 'updated' } });
    await expect(getStackImagesStatus(7)).resolves.toEqual({ Status: 'updated' });
    expect(get).toHaveBeenCalledWith('/stacks/7/images_status');
  });

  it('wraps axios failures with parseAxiosError', async () => {
    get.mockRejectedValue(new Error('network'));
    await expect(getStackImagesStatus(9)).rejects.toThrow(
      'Unable to retrieve image status for stack: 9'
    );
    expect(parseAxiosError).toHaveBeenCalled();
  });
});
