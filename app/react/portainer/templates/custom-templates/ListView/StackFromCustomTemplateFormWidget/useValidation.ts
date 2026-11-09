import { useMemo } from 'react';
import { object, string } from 'yup';

import { useNameValidation } from '@/react/docker/stacks/common/NameField';
import { variablesFieldValidation } from '@/react/portainer/custom-templates/components/CustomTemplatesVariablesField';
import { VariableDefinition } from '@/react/portainer/custom-templates/components/CustomTemplatesVariablesDefinitionField';
import { EnvironmentId } from '@/react/portainer/environments/types';

export function useValidation({
  environmentId,
  variableDefs,
  isDeployable,
}: {
  variableDefs: Array<VariableDefinition>;
  environmentId: EnvironmentId;
  isDeployable: boolean;
}) {
  const name = useNameValidation(environmentId);

  return useMemo(
    () =>
      object({
        name: name.test({
          name: 'is-deployable',
          message: 'This template cannot be deployed on this environment',
          test: () => isDeployable,
        }),
        fileContent: string().required('Required'),
        variables: variablesFieldValidation(variableDefs),
      }),
    [isDeployable, name, variableDefs]
  );
}
