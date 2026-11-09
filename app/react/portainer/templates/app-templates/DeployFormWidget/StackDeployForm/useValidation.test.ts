import { renderHook } from '@testing-library/react-hooks';
import { string } from 'yup';

import { useValidation } from './useValidation';

vi.mock('@/react/docker/stacks/common/NameField', () => ({
  useNameValidation: () => string(),
}));

describe('REQ-TPL-01 stack deploy useValidation', () => {
  it('builds a schema with name and env vars', () => {
    const { result } = renderHook(() =>
      useValidation({
        environmentId: 3,
        envVarDefinitions: [{ name: 'FOO' }],
      })
    );

    expect(
      result.current.isValidSync({
        name: 'stack',
        envVars: { FOO: 'bar' },
      })
    ).toBe(true);
  });
});
