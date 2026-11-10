import { NestedDatatable } from '@@/datatables/NestedDatatable';

import { useColumns } from './columns';
import { DecoratedNetwork } from './types';

export function NestedNetworksDatatable({
  dataset,
}: {
  dataset: Array<DecoratedNetwork>;
}) {
  const columns = useColumns();
  return (
    <NestedDatatable
      columns={columns}
      dataset={dataset}
      aria-label="Networks table"
      data-cy="docker-networks-nested-datatable"
    />
  );
}
