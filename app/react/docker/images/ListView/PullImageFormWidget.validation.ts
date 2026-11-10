import { useMemo } from 'react';
import { SchemaOf, object, string } from 'yup';

import { imageConfigValidation } from '@@/ImageConfigFieldset';

import { FormValues } from './PullImageFormWidget.types';

export function useValidation(isNodeVisible: boolean): SchemaOf<FormValues> {
  return useMemo(
    () =>
      object({
        config: imageConfigValidation(),
        node: isNodeVisible
          ? string().required('Node is required')
          : string().default(''),
      }),
    [isNodeVisible]
  );
}
