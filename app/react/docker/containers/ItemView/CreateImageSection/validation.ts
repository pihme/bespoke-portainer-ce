import { useMemo } from 'react';
import { SchemaOf, object } from 'yup';

import { imageConfigValidation } from '@@/ImageConfigFieldset';

import { FormValues } from './types';

export function useValidation(): SchemaOf<FormValues> {
  return useMemo(
    () =>
      object({
        config: imageConfigValidation(),
      }),
    []
  );
}
