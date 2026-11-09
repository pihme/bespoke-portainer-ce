import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';
import { capabilities } from './types';

describe('REQ-HOST-04 capabilities toViewModel', () => {
  it('keeps CapAdd and restores missing default capabilities', () => {
    const config: ContainerDetailsJSON = {
      HostConfig: {
        CapAdd: ['SYS_ADMIN'],
        CapDrop: ['MKNOD'],
      },
    };

    const result = toViewModel(config);
    const defaultKeys = capabilities
      .filter((cap) => cap.default)
      .map((cap) => cap.key);

    expect(result).toContain('SYS_ADMIN');
    expect(result).not.toContain('MKNOD');
    for (const key of defaultKeys) {
      if (key !== 'MKNOD') {
        expect(result).toContain(key);
      }
    }
  });

  it('defaults to the capability catalog defaults', () => {
    expect(getDefaultViewModel()).toEqual(
      capabilities.filter((cap) => cap.default).map((cap) => cap.key)
    );
  });
});
