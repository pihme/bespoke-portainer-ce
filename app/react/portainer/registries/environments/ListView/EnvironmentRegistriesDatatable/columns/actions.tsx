import { CellContext } from '@tanstack/react-table';

import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { DecoratedRegistry } from '@/react/portainer/registries/ListView/RegistriesDatatable/types';
import { columnHelper } from '@/react/portainer/registries/ListView/RegistriesDatatable/columns/helper';
import { BrowseButton } from '@/react/portainer/registries/ListView/RegistriesDatatable/columns/actions';

export const actions = columnHelper.display({
  header: 'Actions',
  cell: Cell,
});

function Cell({
  row: { original: item },
}: CellContext<DecoratedRegistry, unknown>) {
  const environmentId = useEnvironmentId();

  // Per-user/team registry access is removed (TAI-001) and the Kubernetes
  // namespace "Manage access" went with Kubernetes (TAI-002).
  if (!item.Id) {
    return null;
  }

  return <BrowseButton registry={item} environmentId={environmentId} />;
}
