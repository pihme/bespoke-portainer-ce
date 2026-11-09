import { useCurrentStateAndParams } from '@uirouter/react';
import { useEffect } from 'react';

import { StackContainersDatatable } from '@/react/docker/stacks/ItemView/StackContainersDatatable';
import { useStack } from '@/react/common/stacks/queries/useStack';
import { Stack, StackStatus, StackType } from '@/react/common/stacks/types';
import { notifyError } from '@/portainer/services/notifications';
import { useUpdateStackResourcesOnDeployment } from '@/react/docker/stacks/ItemView/useUpdateStackResourcesOnDeployment';

import { PageHeader } from '@@/PageHeader';

import { StackDetails } from './StackDetails';

export function ItemView() {
  const {
    isExternal,
    isOrphaned,
    isOrphanedRunning,
    isRegular,
    stackName,
    stackId,
    stackType,
  } = useParams();

  const stackQuery = useStack(stackId, {
    enabled: isRegular || isOrphaned,
    refetchInterval: (data) =>
      data?.Status === StackStatus.Deploying ? 3000 : false,
  });

  const stack = stackQuery.data;

  useUpdateStackResourcesOnDeployment(stack);

  useEffect(() => {
    if (
      isInvalidStackType({
        isExternal,
        isOrphaned,
        isOrphanedRunning,
        stackType,
      })
    ) {
      notifyError('Failure', undefined, 'Invalid type URL parameter.');
    }
  }, [isExternal, isOrphaned, isOrphanedRunning, stackType]);

  return (
    <>
      <PageHeader
        title="Stack details"
        breadcrumbs={[{ label: 'Stacks', link: '^' }, stackName]}
      />
      <StackDetails
        isExternal={isExternal}
        isOrphaned={isOrphaned}
        isOrphanedRunning={isOrphanedRunning}
        isRegular={isRegular}
        stackName={stackName}
        stack={stack}
      />
      <div className="space-y-4">
        {(!isOrphaned || isOrphanedRunning) && (
          <>
            {stackType === StackType.DockerCompose && (
              <StackContainersDatatable stackName={stackName} />
            )}
          </>
        )}
      </div>
    </>
  );
}

function isInvalidStackType({
  isExternal,
  isOrphaned,
  isOrphanedRunning,
  stackType,
}: {
  isExternal: boolean;
  isOrphaned: boolean;
  isOrphanedRunning: boolean;
  stackType: StackType | undefined;
}) {
  return (
    (isExternal || (isOrphaned && isOrphanedRunning)) &&
    (!stackType ||
      stackType !== StackType.DockerCompose)
  );
}

function useParams() {
  /*
TODO Check:
why use stack.Name or params.stackName?
why use booleans from params instead of figuring out by name/id
why stack.EndpointID and not params.envId?
*/
  const { params } = useCurrentStateAndParams();
  const isRegular = params.regular === 'true';
  const isExternal = params.external === 'true';
  const isOrphaned = params.orphaned === 'true';
  const isOrphanedRunning = params.orphanedRunning === 'true';
  const stackName = params.name || ('' as string);
  const id = params.id ? (parseInt(params.id, 10) as Stack['Id']) : undefined;
  const type = ['1', '2', '3'].includes(params.type)
    ? (parseInt(params.type, 10) as StackType)
    : undefined;

  return {
    isExternal,
    isRegular,
    isOrphaned,
    isOrphanedRunning,
    stackName,
    stackId: id,
    stackType: type,
  };
}
