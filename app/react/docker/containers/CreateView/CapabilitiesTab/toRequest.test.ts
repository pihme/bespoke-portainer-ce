import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { toRequest } from './toRequest';
import { capabilities } from './types';

describe('REQ-HOST-04 capabilities toRequest', () => {
  const config: CreateContainerRequest = {
    HostConfig: {},
    NetworkingConfig: {},
  };

  it('clears capabilities when they are hidden', () => {
    expect(toRequest(config, ['CHOWN'], true).HostConfig).toMatchObject({
      CapAdd: [],
      CapDrop: [],
    });
  });

  it('adds selected capabilities and drops the rest', () => {
    const selected = ['CHOWN', 'NET_RAW'];
    const result = toRequest(config, selected, false);

    expect(result.HostConfig.CapAdd).toEqual(selected);
    expect(result.HostConfig.CapDrop).toEqual(
      capabilities
        .filter((cap) => !selected.includes(cap.key))
        .map((cap) => cap.key)
    );
  });
});
