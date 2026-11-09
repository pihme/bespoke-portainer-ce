import { renderHook } from '@testing-library/react-hooks';
import { string, mixed } from 'yup';

import { useValidation } from './useValidation';

vi.mock('@/react/docker/stacks/common/NameField', () => ({
  useNameValidation: () => string().required('name required'),
}));
vi.mock(
  '@/react/portainer/custom-templates/components/CustomTemplatesVariablesField',
  () => ({
    variablesFieldValidation: () => mixed(),
  })
);

describe('useValidation', () => {
  it('rejects when the template is not deployable', async () => {
    const { result } = renderHook(() =>
      useValidation({
        environmentId: 1,
        variableDefs: [],
        isDeployable: false,
      })
    );

    await expect(
      result.current.validate({
        name: 'stack',
        fileContent: 'services: {}',
        variables: {},
      })
    ).rejects.toBeTruthy();
  });

  it('accepts a deployable local Compose form', async () => {
    const { result } = renderHook(() =>
      useValidation({
        environmentId: 1,
        variableDefs: [],
        isDeployable: true,
      })
    );

    await expect(
      result.current.validate({
        name: 'stack',
        fileContent: 'services: {}',
        variables: {},
      })
    ).resolves.toBeTruthy();
  });
});
