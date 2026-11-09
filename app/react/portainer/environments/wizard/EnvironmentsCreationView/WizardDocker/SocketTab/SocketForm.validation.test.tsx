import { renderHook } from '@testing-library/react-hooks';
import { array, number, object, string } from 'yup';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/portainer/environments/common/NameField/NameField', () => ({
  useNameValidation: () => string().required('Name is required'),
}));

vi.mock(
  '@/react/portainer/environments/common/MetadataFieldset/validation',
  () => ({
    metadataValidation: () =>
      object({ groupId: number(), tagIds: array() }),
  })
);

import { useValidation } from './SocketForm.validation';

describe('SocketForm validation', () => {
  it('requires socketPath only when overridePath is enabled', async () => {
    const { result } = renderHook(() => useValidation());
    await expect(
      result.current.validate({
        name: 'local',
        overridePath: false,
        socketPath: '',
        meta: { groupId: 1, tagIds: [] },
      })
    ).resolves.toEqual({
      name: 'local',
      overridePath: false,
      socketPath: '',
      meta: { groupId: 1, tagIds: [] },
    });

    await expect(
      result.current.validate({
        name: 'local',
        overridePath: true,
        socketPath: '',
        meta: { groupId: 1, tagIds: [] },
      })
    ).rejects.toThrow(/Socket Path is required/);
  });
});
