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

vi.mock('@/react/components/TLSFieldset/TLSFieldset', () => ({
  tlsConfigValidation: () => object({}),
}));

import { useValidation } from './APIForm.validation';

describe('APIForm validation', () => {
  it('requires a Docker API url', async () => {
    const { result } = renderHook(() => useValidation());
    await expect(
      result.current.validate({
        name: 'remote',
        url: '',
        tlsConfig: {},
        meta: { groupId: 1, tagIds: [] },
      })
    ).rejects.toThrow(/required/i);

    await expect(
      result.current.validate({
        name: 'remote',
        url: 'tcp://docker:2375',
        tlsConfig: {},
        meta: { groupId: 1, tagIds: [] },
      })
    ).resolves.toMatchObject({ url: 'tcp://docker:2375' });
  });
});
