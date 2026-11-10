import _ from 'lodash';
import { useMemo } from 'react';

import { isoDate, truncateLeftRight } from '@/portainer/filters/filters';

import { columnHelper } from './helper';
import { name } from './name';

export function useColumns() {
  return useMemo(
    () =>
      _.compact([
        name,
        columnHelper.accessor((item) => item.StackName || '-', {
          header: 'Stack',
        }),
        columnHelper.accessor((item) => item.Driver, {
          header: 'Driver',
        }),
        columnHelper.accessor((item) => item.Mountpoint, {
          header: 'Mount point',
          cell({ getValue }) {
            return truncateLeftRight(getValue());
          },
        }),
        columnHelper.accessor((item) => item.CreatedAt, {
          header: 'Created',
          cell({ getValue }) {
            return isoDate(getValue());
          },
        }),
      ]),
    []
  );
}
