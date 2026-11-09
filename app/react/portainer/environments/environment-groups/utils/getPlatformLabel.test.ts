import { describe, expect, it } from 'vitest';

import { EnvironmentGroup } from '../types';

import {
  getPlatformLabel,
  isUngoverned,
  UNASSIGNED_GROUP_ID,
  UNASSIGNED_GROUP_NAME,
} from './getPlatformLabel';

function group(partial: Record<string, unknown> = {}): EnvironmentGroup {
  return {
    Id: 2,
    Name: 'g',
    Description: '',
    TagIds: [],
    Total: 0,
    ...partial,
  } as EnvironmentGroup;
}

describe('getPlatformLabel', () => {
  it('labels empty, docker, and mixed groups', () => {
    expect(getPlatformLabel(group({ Total: 0 }))).toBe('Empty');
    expect(getPlatformLabel(group({ Total: undefined }))).toBe('Empty');
    expect(
      getPlatformLabel(
        group({
          Total: 2,
          TypeInfo: { Mixed: false, Docker: 2, Kubernetes: 0, Podman: 0 },
        })
      )
    ).toBe('Docker');
    expect(getPlatformLabel(group({ Total: 2, TypeInfo: undefined }))).toBe(
      'Mixed'
    );
    expect(
      getPlatformLabel(
        group({
          Total: 3,
          TypeInfo: { Mixed: true, Docker: 1, Kubernetes: 1, Podman: 1 },
        })
      )
    ).toBe('Mixed');
    // Non-docker pure types deferred; still exercise empty fallthrough when Mixed=false and counts are zero
    expect(
      getPlatformLabel(
        group({
          Total: 1,
          TypeInfo: { Mixed: false, Docker: 0, Kubernetes: 0, Podman: 0 },
        })
      )
    ).toBe('Empty');
  });

  it('detects the unassigned group', () => {
    expect(UNASSIGNED_GROUP_NAME).toBe('Unassigned');
    expect(isUngoverned(group({ Id: UNASSIGNED_GROUP_ID }))).toBe(true);
    expect(isUngoverned(group({ Id: 5 }))).toBe(false);
  });
});
