import { describe, expect, it } from 'vitest';

import { buildDockerUrl } from './buildDockerUrl';
import {
  buildDockerSnapshotContainersUrl,
  queryKeys as containerQueryKeys,
} from './container';
import {
  buildDockerSnapshotUrl,
  queryKeys as rootQueryKeys,
} from './root';
import {
  buildDockerSnapshotContainersUrl as reexportedContainersUrl,
  buildDockerSnapshotUrl as reexportedSnapshotUrl,
  queryKeys,
} from './index';

describe('buildDockerUrl', () => {
  it('builds the base action url', () => {
    expect(buildDockerUrl(1, 'containers')).toBe('/docker/1/containers');
  });

  it('appends defined sub segments and skips undefined', () => {
    expect(buildDockerUrl(1, 'containers', 'abc', undefined, 'json')).toBe(
      '/docker/1/containers/abc/json'
    );
  });

  it('omits the trailing slash when all sub segments are empty', () => {
    expect(buildDockerUrl(3, 'snapshot', undefined, null, '')).toBe(
      '/docker/3/snapshot'
    );
  });
});

describe('root query helpers', () => {
  it('builds root, snapshot, snapshotQuery and plugins keys', () => {
    expect(rootQueryKeys.root(2)).toEqual(['docker', 2]);
    expect(rootQueryKeys.snapshot(2)).toEqual(['docker', 2, 'snapshot']);
    expect(rootQueryKeys.snapshotQuery(2)).toEqual(['docker', 2, 'snapshot']);
    expect(rootQueryKeys.plugins(2)).toEqual(['docker', 2, 'plugins']);
  });

  it('buildDockerSnapshotUrl delegates to buildDockerUrl', () => {
    expect(buildDockerSnapshotUrl(7)).toBe('/docker/7/snapshot');
  });
});

describe('container query helpers', () => {
  it('builds container query keys', () => {
    expect(containerQueryKeys.containers(1)).toEqual([
      'docker',
      1,
      'snapshot',
      'containers',
    ]);
    expect(containerQueryKeys.containersQuery(1, {})).toEqual([
      'docker',
      1,
      'snapshot',
      'containers',
      {},
    ]);
    expect(containerQueryKeys.container(1, 'cid')).toEqual([
      'docker',
      1,
      'snapshot',
      'containers',
      'cid',
    ]);
  });

  it('buildDockerSnapshotContainersUrl with and without container id', () => {
    expect(buildDockerSnapshotContainersUrl(4)).toBe(
      '/docker/4/snapshot/containers'
    );
    expect(buildDockerSnapshotContainersUrl(4, 'abc')).toBe(
      '/docker/4/snapshot/containers/abc'
    );
  });
});

describe('utils index re-exports', () => {
  it('exposes merged queryKeys and builders', () => {
    expect(queryKeys.root(1)).toEqual(['docker', 1]);
    expect(queryKeys.containers(1)).toEqual([
      'docker',
      1,
      'snapshot',
      'containers',
    ]);
    expect(reexportedSnapshotUrl(5)).toBe('/docker/5/snapshot');
    expect(reexportedContainersUrl(5, 'x')).toBe(
      '/docker/5/snapshot/containers/x'
    );
  });
});
