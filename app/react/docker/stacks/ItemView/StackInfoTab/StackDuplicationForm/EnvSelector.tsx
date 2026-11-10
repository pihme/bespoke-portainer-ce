import { useMemo } from 'react';
import { sortBy } from 'lodash';

import { useEnvironmentList } from '@/react/portainer/environments/queries';
import { Environment } from '@/react/portainer/environments/types';

import { PortainerSelect, Option } from '@@/form-components/PortainerSelect';
import { FormError } from '@@/form-components/FormError';

export function EnvSelector({
  value,
  onChange,
  error,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string;
}) {
  const envsQuery = useEnvironmentList();

  const environmentOptions = useMemo(() => {
    if (!envsQuery.environments) {
      return [];
    }

    return getEnvironmentOptions(envsQuery.environments);
  }, [envsQuery.environments]);

  if (!environmentOptions.length) {
    return null;
  }

  return (
    <div className="form-group">
      <PortainerSelect
        value={value}
        onChange={onChange}
        options={environmentOptions}
        placeholder="Select an environment"
        data-cy="stack-duplicate-environment-select"
      />
      {error && (
        <div className="col-sm-12">
          <FormError>{error}</FormError>
        </div>
      )}
    </div>
  );
}

/**
 * Transforms environments into options for PortainerSelect, sorted by name.
 * Environment groups are removed (TAI-013), so the list is flat.
 */
export function getEnvironmentOptions(
  environments: Environment[],
  currentEnvironmentId?: number
): Option<number>[] {
  if (!environments) {
    return [];
  }

  return sortBy(
    environments
      .filter((environment) => environment.Id !== currentEnvironmentId)
      .map((environment) => ({
        label: environment.Name,
        value: environment.Id,
      })),
    'label'
  );
}
