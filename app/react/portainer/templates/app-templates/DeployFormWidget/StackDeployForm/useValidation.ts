import { useMemo } from 'react';
import { SchemaOf, object } from 'yup';

import { useNameValidation } from '@/react/docker/stacks/common/NameField';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { envVarsFieldsetValidation } from '../EnvVarsFieldset';
import { TemplateEnv } from '../../types';

import { FormValues } from './types';

export function useValidation({
  environmentId,
  envVarDefinitions,
}: {
  environmentId: EnvironmentId;
  envVarDefinitions: Array<TemplateEnv>;
}): SchemaOf<FormValues> {
  const name = useNameValidation(environmentId);

  return useMemo(
    () =>
      object({
        name,
        envVars: envVarsFieldsetValidation(envVarDefinitions),
      }),
    [envVarDefinitions, name]
  );
}
