import { describe, it, expect } from 'vitest';

import { StatusViewModel, StatusVersionViewModel } from './status';

describe('REQ-ENV-02 StatusViewModel mapping', () => {
  it('maps authentication, snapshot, version, edition and instance id', () => {
    const vm = new StatusViewModel({
      Authentication: true,
      Snapshot: true,
      Version: '2.33.0',
      Edition: 'CE',
      InstanceID: 'abc-123',
    });

    expect(vm.Authentication).toBe(true);
    expect(vm.Snapshot).toBe(true);
    expect(vm.Version).toBe('2.33.0');
    expect(vm.Edition).toBe('CE');
    expect(vm.InstanceID).toBe('abc-123');
  });
});

describe('REQ-ENV-02 StatusVersionViewModel mapping', () => {
  it('maps update availability and latest version', () => {
    const available = new StatusVersionViewModel({
      UpdateAvailable: true,
      LatestVersion: '2.34.0',
    });
    expect(available.UpdateAvailable).toBe(true);
    expect(available.LatestVersion).toBe('2.34.0');

    const current = new StatusVersionViewModel({
      UpdateAvailable: false,
      LatestVersion: '2.33.0',
    });
    expect(current.UpdateAvailable).toBe(false);
    expect(current.LatestVersion).toBe('2.33.0');
  });
});
