import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-09 volumes toViewModel for create form', () => {
  it('maps mounts including bind sources and read-only flags', () => {
    const config: ContainerDetailsJSON = {
      Mounts: [
        {
          Type: 'volume',
          Name: 'data',
          Destination: '/data',
          RW: true,
        },
        {
          Type: 'bind',
          Source: '/host/cfg',
          Destination: '/cfg',
          RW: false,
        },
        {
          Destination: '/anon',
          RW: true,
        },
      ],
    };

    expect(toViewModel(config)).toEqual([
      {
        type: 'volume',
        name: 'data',
        containerPath: '/data',
        readOnly: false,
      },
      {
        type: 'bind',
        name: '/host/cfg',
        containerPath: '/cfg',
        readOnly: true,
      },
      {
        type: 'volume',
        name: '',
        containerPath: '/anon',
        readOnly: false,
      },
    ]);
  });

  it('defaults to an empty list', () => {
    expect(toViewModel({})).toEqual([]);
    expect(getDefaultViewModel()).toEqual([]);
  });
});
