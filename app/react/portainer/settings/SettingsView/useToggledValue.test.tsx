import { renderHook, act } from '@testing-library/react-hooks';
import { Formik, Form } from 'formik';
import { ReactNode } from 'react';

import { useToggledValue } from './useToggledValue';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <Formik initialValues={{ token: 'secret', tokenEnabled: true }} onSubmit={() => {}}>
      <Form>{children}</Form>
    </Formik>
  );
}

describe('REQ-SET-01 useToggledValue', () => {
  it('toggles the enabled flag and restores the previous value', async () => {
    const { result } = renderHook(() => useToggledValue('token'), { wrapper });

    expect(result.current[0]).toBe(true);

    await act(async () => {
      await result.current[1](false);
    });
    expect(result.current[0]).toBe(false);

    await act(async () => {
      await result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
  });
});
