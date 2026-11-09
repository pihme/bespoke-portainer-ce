import { renderHook } from '@testing-library/react-hooks';
import { object, string } from 'yup';

import { useValidation } from './useValidation';

vi.mock('@/react/portainer/access-control/AccessControlForm', () => ({
  accessControlFormValidation: () => object({}),
}));
vi.mock('@/react/docker/stacks/common/NameField', () => ({
  useNameValidation: () => string(),
}));

describe('REQ-TPL-01 stack deploy useValidation', () => {
  it('builds a schema with name access control and env vars', () => {
    const { result } = renderHook(() =>
      useValidation({
        isAdmin: false,
        environmentId: 3,
        envVarDefinitions: [{ name: 'FOO' }],
      })
    );

    expect(
      result.current.isValidSync({
        name: 'stack',
        accessControl: {},
        envVars: { FOO: 'bar' },
      })
    ).toBe(true);
  });
});
