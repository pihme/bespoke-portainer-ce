import _ from 'lodash';
import { useMemo } from 'react';

import { useIsSwarm } from '@/react/docker/proxy/queries/useInfo';
import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { isoDate, truncateLeftRight } from '@/portainer/filters/filters';

import { columnHelper } from './helper';
import { name } from './name';

export function useColumns() {
  const environmentId = useEnvironmentId();
  const isSwarm = useIsSwarm(environmentId);

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
        isSwarm &&
          columnHelper.accessor((item) => item.NodeName || '-', {
            header: 'Host',
          }),
      ]),
    [isSwarm]
  );
}
