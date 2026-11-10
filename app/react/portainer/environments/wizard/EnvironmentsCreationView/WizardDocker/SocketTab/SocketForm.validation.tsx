import { boolean, object, SchemaOf, string } from 'yup';

import { useNameValidation } from '@/react/portainer/environments/common/NameField/NameField';

import { FormValues } from './types';

export function useValidation(): SchemaOf<FormValues> {
  return object({
    name: useNameValidation(),
    overridePath: boolean().default(false),
    socketPath: string()
      .default('')
      .when('overridePath', (overridePath, schema) =>
        overridePath
          ? schema.required(
              'Socket Path is required when override path is enabled'
            )
          : schema
      ),
  });
}
