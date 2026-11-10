import { render } from '@testing-library/react';

import { FormValues } from './PullImageFormWidget.types';
import { useValidation } from './PullImageFormWidget.validation';

function setup() {
  const returnVal: { schema?: ReturnType<typeof useValidation> } = {
    schema: undefined,
  };
  function TestComponent() {
    Object.assign(returnVal, { schema: useValidation() });
    return null;
  }
  render(<TestComponent />);
  return returnVal;
}

test('image is required', async () => {
  const { schema } = setup();
  const object: FormValues = {
    config: { image: '' },
  };

  await expect(
    schema?.validate(object, { strict: true })
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ValidationError: Image is required]`
  );
});

test('REQ-TAI-007 has no node field', () => {
  const { schema } = setup();
  expect(Object.keys(schema?.fields ?? {})).toEqual(['config']);
});
