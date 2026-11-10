import { SchemaOf, boolean, object, string } from 'yup';

import { isValidUrl } from '@@/form-components/validate-url';

import { Values } from './types';

export function validation(): SchemaOf<Values> {
  return object({
    logoEnabled: boolean().default(false),
    logo: string()
      .default('')
      .when('logoEnabled', {
        is: true,
        then: (schema) =>
          schema
            .required('Logo url is required when enabled')
            .test('valid-url', 'Must be a valid URL', (value) =>
              isValidUrl(value)
            ),
      }),
    snapshotInterval: string().required('Snapshot interval is required'),
    templatesUrl: string()
      .default('')
      .test(
        'valid-url',
        'Must be a valid URL',
        (value) => !value || isValidUrl(value)
      ),
  });
}
