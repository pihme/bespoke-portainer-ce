import { useMemo } from 'react';
import { boolean, object, SchemaOf } from 'yup';

import { buildGitValidationSchema } from '@/react/portainer/gitops/GitForm';

import { envVarValidation } from '@@/form-components/EnvironmentVariablesFieldset';

import { FormValues } from './types';

export function useValidationSchema(): SchemaOf<FormValues> {
  return useMemo(
    () =>
      object({
        git: buildGitValidationSchema('compose'),

        env: envVarValidation(),
        prune: boolean().default(false),
        redeployNow: boolean().default(false),
      }),
    []
  );
}
