import { useCurrentStateAndParams } from '@uirouter/react';

import { ContainerDetailsViewModel } from '@/docker/models/containerDetails';
import { trimContainerName } from '@/docker/filters/utils';
import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';

import { PageHeader } from '@@/PageHeader';

import { useContainer } from '../queries/useContainer';

import { ContainerActionsSection } from './ContainerActionsSection/ContainerActionsSection';
import { ContainerStatusSection } from './ContainerStatusSection/ContainerStatusSection';
import { CreateImageSection } from './CreateImageSection/CreateImageSection';
import { ContainerDetailsSection } from './ContainerDetailsSection/ContainerDetailsSection';
import { VolumesSection } from './VolumesSection/VolumesSection';
import { ContainerNetworksDatatable } from './ContainerNetworksDatatable';
import { HealthStatus } from './HealthStatus';

export function ItemView() {
  const environmentId = useEnvironmentId();
  const {
    params: { id: containerId, nodeName },
  } = useCurrentStateAndParams();

  const containerQuery = useContainer(
    { environmentId, containerId, nodeName },
    { select: (c) => new ContainerDetailsViewModel(c) }
  );

  if (containerQuery.isLoading || !containerQuery.data) {
    return null;
  }

  const container = containerQuery.data;

  const containerName =
    trimContainerName(container.Name) || container.Id || 'unknown';

  return (
    <>
      <PageHeader
        title="Container details"
        breadcrumbs={[
          { label: 'Containers', link: 'docker.containers' },
          containerName,
        ]}
      />

      <div className="mx-4 mb-4 space-y-4 [&>*]:block">
        <ContainerActionsSection
          environmentId={environmentId}
          nodeName={nodeName}
          container={container}
        />

        <ContainerStatusSection
          environmentId={environmentId}
          nodeName={nodeName}
          container={container}
        />
      </div>

      {container.State?.Health && (
        <HealthStatus health={container.State.Health} />
      )}

      <div className="mx-4 mb-4 space-y-4 [&>*]:block">
        <CreateImageSection
          environmentId={environmentId}
          containerId={container.Id || ''}
        />

        <ContainerDetailsSection
          environmentId={environmentId}
          container={container}
          nodeName={nodeName}
        />

        <VolumesSection volumes={container.Mounts} nodeName={nodeName} />
      </div>

      {container.NetworkSettings?.Networks && (
        <ContainerNetworksDatatable
          dataset={container.NetworkSettings.Networks}
          containerId={containerId}
          nodeName={nodeName}
        />
      )}
    </>
  );
}
