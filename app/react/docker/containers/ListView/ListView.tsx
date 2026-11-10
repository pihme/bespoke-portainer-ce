import { Environment } from '@/react/portainer/environments/types';

import { PageHeader } from '@@/PageHeader';

import { ContainersDatatable } from './ContainersDatatable';

interface Props {
  endpoint: Environment;
}

// The per-node host column is removed with the Portainer Agent (TAI-007).
export function ListView({ endpoint: environment }: Props) {
  return (
    <>
      <PageHeader
        title="Container list"
        breadcrumbs={[{ label: 'Containers' }]}
        reload
      />

      <ContainersDatatable environment={environment} />
    </>
  );
}
