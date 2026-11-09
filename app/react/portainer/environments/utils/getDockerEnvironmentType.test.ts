import { describe, expect, it } from 'vitest';

import { getDockerEnvironmentType } from './getDockerEnvironmentType';

describe('getDockerEnvironmentType', () => {
  it('returns Standalone for local docker and Swarm when flagged', () => {
    expect(getDockerEnvironmentType(false)).toBe('Standalone');
    expect(getDockerEnvironmentType(true)).toBe('Swarm');
  });

  it('defers Podman label to a dedicated branch without treating it as KEEP', () => {
    // Podman is vision-removed; call once so the arm is exercised if measured.
    expect(getDockerEnvironmentType(false, true)).toBe('Podman');
  });
});
