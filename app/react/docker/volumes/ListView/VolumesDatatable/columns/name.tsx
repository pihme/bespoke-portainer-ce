import { CellContext, Column } from '@tanstack/react-table';

import { truncate } from '@/portainer/filters/filters';
import { getValueAsArrayOfStrings } from '@/portainer/helpers/array';

import { Link } from '@@/Link';
import { MultipleSelectionFilter } from '@@/datatables/Filter';
import { UnusedBadge } from '@@/Badge/UnusedBadge';

import { DecoratedVolume } from '../../types';

import { columnHelper } from './helper';

export const name = columnHelper.accessor('Name', {
  id: 'name',
  header: 'Name',
  cell: Cell,
  enableColumnFilter: true,
  filterFn: (
    { original: { dangling } },
    columnId,
    filterValue: Array<'Used' | 'Unused'>
  ) => {
    if (filterValue.length === 0) {
      return true;
    }

    if (filterValue.includes('Used') && !dangling) {
      return true;
    }

    if (filterValue.includes('Unused') && dangling) {
      return true;
    }

    return false;
  },
  meta: {
    filter: FilterByUsage,
  },
});

function FilterByUsage<TData extends { Used: boolean }>({
  column: { getFilterValue, setFilterValue, id },
}: {
  column: Column<TData>;
}) {
  const options = ['Used', 'Unused'];

  const value = getFilterValue();

  const valueAsArray = getValueAsArrayOfStrings(value);

  return (
    <MultipleSelectionFilter
      options={options}
      filterKey={id}
      value={valueAsArray}
      onChange={setFilterValue}
      menuTitle="Filter by usage"
    />
  );
}

function Cell({
  getValue,
  row: { original: item },
}: CellContext<DecoratedVolume, string>) {
  // The volume file browser (Browse button) is removed (TAI-010).
  const name = getValue();

  return (
    <div className="flex gap-2">
      <Link
        to=".volume"
        params={{
          id: item.Name,
          nodeName: item.NodeName,
        }}
        data-cy={`volume-link-${name}`}
        title={name}
      >
        {truncate(name, 40)}
      </Link>
      {item.dangling && <UnusedBadge />}
    </div>
  );
}
