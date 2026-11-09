import { CellContext } from '@tanstack/react-table';
import { Users } from 'lucide-react';

import { useAuthorizations } from '@/react/hooks/useUser';
import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { useCurrentEnvironment } from '@/react/hooks/useCurrentEnvironment';
import { isKubernetesEnvironment } from '@/react/portainer/environments/utils';
import { DecoratedRegistry } from '@/react/portainer/registries/ListView/RegistriesDatatable/types';
import { RegistryTypes } from '@/react/portainer/registries/types/registry';
import { columnHelper } from '@/react/portainer/registries/ListView/RegistriesDatatable/columns/helper';
import { BrowseButton } from '@/react/portainer/registries/ListView/RegistriesDatatable/columns/actions';

import { Button } from '@@/buttons';
import { Link } from '@@/Link';

export const actions = columnHelper.display({
  header: 'Actions',
  cell: Cell,
});

function Cell({
  row: { original: item },
}: CellContext<DecoratedRegistry, unknown>) {
  const environmentId = useEnvironmentId();
  const { authorized: canUpdateAccess } = useAuthorizations(
    ['PortainerRegistryUpdateAccess'],
    environmentId,
    true
  );
  const environmentQuery = useCurrentEnvironment();
  // Per-user/team Docker registry access is removed (TAI-001); only the
  // Kubernetes namespace assignment remains behind "Manage access".
  const isKubernetes =
    !!environmentQuery.data &&
    isKubernetesEnvironment(environmentQuery.data.Type);
  const canManageAccess =
    isKubernetes && item.Type !== RegistryTypes.ANONYMOUS && canUpdateAccess;

  if (!item.Id) {
    return null;
  }

  return (
    <>
      {canManageAccess && (
        <Button
          color="link"
          icon={Users}
          as={Link}
          props={{
            to: '.access',
            params: { id: item.Id },
          }}
          data-cy={`registry-manage-access-button-${item.Name}`}
        >
          Manage access
        </Button>
      )}
      <BrowseButton registry={item} environmentId={environmentId} />
    </>
  );
}
