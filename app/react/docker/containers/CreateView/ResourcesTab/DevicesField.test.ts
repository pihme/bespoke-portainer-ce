import { describe, expect, it } from 'vitest';

import { devicesValidation, toDevicesViewModel } from './DevicesField';

describe('REQ-CTR-03 devices field helpers', () => {
  it('keeps devices that have both host and container paths', () => {
    expect(
      toDevicesViewModel([
        {
          PathOnHost: '/dev/null',
          PathInContainer: '/dev/null',
          CgroupPermissions: 'rwm',
        },
        { PathOnHost: '', PathInContainer: '/x' },
      ])
    ).toEqual([{ pathOnHost: '/dev/null', pathInContainer: '/dev/null' }]);
  });

  it('requires host and container paths', async () => {
    await expect(
      devicesValidation().validate([
        { pathOnHost: '', pathInContainer: '/dev/null' },
      ])
    ).rejects.toThrow(/Host path is required/);
  });
});
