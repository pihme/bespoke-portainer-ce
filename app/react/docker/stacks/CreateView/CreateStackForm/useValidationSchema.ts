import { useMemo } from 'react';
import _ from 'lodash';

import { EnvironmentId } from '@/react/portainer/environments/types';
import { useStacks } from '@/react/common/stacks/queries/useStacks';
import { useContainers } from '@/react/docker/containers/queries/useContainers';

import { getValidationSchema } from './validation';

export function useValidationSchema(environmentId: EnvironmentId) {
  const stacksQuery = useStacks();
  const containersQuery = useContainers(environmentId, {
    select: (containers) =>
      containers.flatMap((c) => c.Names).map((name) => _.trimStart(name, '/')),
  });

  const containerNames = containersQuery.data;
  const stacks = stacksQuery.data;

  return useMemo(
    () =>
      getValidationSchema({
        environmentId,
        stacks,
        containerNames,
      }),
    [environmentId, stacks, containerNames]
  );
}
