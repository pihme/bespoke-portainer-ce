import { renderHook } from '@testing-library/react-hooks';
import { string } from 'yup';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/portainer/environments/common/NameField/NameField', () => ({
  useNameValidation: () => string().required('Name is required'),
}));

import { useValidation } from './SocketForm.validation';

describe('SocketForm validation', () => {
  it('requires socketPath only when overridePath is enabled', async () => {
    const { result } = renderHook(() => useValidation());
    await expect(
      result.current.validate({
        name: 'local',
        overridePath: false,
        socketPath: '',
      })
    ).resolves.toEqual({
      name: 'local',
      overridePath: false,
      socketPath: '',
    });

    await expect(
      result.current.validate({
        name: 'local',
        overridePath: true,
        socketPath: '',
      })
    ).rejects.toThrow(/Socket Path is required/);
  });
});
