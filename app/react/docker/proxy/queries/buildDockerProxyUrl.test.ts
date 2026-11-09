import { describe, expect, it } from 'vitest';

import { buildDockerProxyUrl } from './buildDockerProxyUrl';

describe('buildDockerProxyUrl (backwards compatibility)', () => {
  it('builds the docker proxy path for an environment and action', () => {
    expect(buildDockerProxyUrl(1, 'info')).toBe('/endpoints/1/docker/info');
  });

  it('appends defined sub-segments and skips undefined ones', () => {
    expect(buildDockerProxyUrl(2, 'images', 'sha256:abc', 'json')).toBe(
      '/endpoints/2/docker/images/sha256:abc/json'
    );
    expect(buildDockerProxyUrl(3, 'services', undefined, 'update')).toBe(
      '/endpoints/3/docker/services/update'
    );
    expect(buildDockerProxyUrl(4, 'services', 'ubx3r', undefined)).toBe(
      '/endpoints/4/docker/services/ubx3r'
    );
  });

  it('returns the action path when every sub-segment is undefined', () => {
    expect(buildDockerProxyUrl(5, 'services')).toBe(
      '/endpoints/5/docker/services'
    );
    expect(buildDockerProxyUrl(5, 'services', undefined, undefined)).toBe(
      '/endpoints/5/docker/services'
    );
  });
});
