import { describe, expect, it } from 'vitest';

import { getDockerEnvironmentType } from './getDockerEnvironmentType';

describe('getDockerEnvironmentType', () => {
  it('returns Standalone for local docker', () => {
    expect(getDockerEnvironmentType()).toBe('Standalone');
    expect(getDockerEnvironmentType(false)).toBe('Standalone');
  });

  it('returns Podman for a Podman engine', () => {
    expect(getDockerEnvironmentType(true)).toBe('Podman');
  });
});
