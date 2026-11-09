import { describe, it, expect } from 'vitest';

import { ImageViewModel } from './image';

describe('REQ-IMG-01 ImageViewModel list mapping', () => {
  it('maps tags, size, labels and used flag from an image summary', () => {
    const vm = new ImageViewModel(
      {
        Id: 'sha256:aaa',
        Created: 1700000000,
        RepoTags: ['nginx:latest', 'nginx:1.25'],
        Size: 42_000_000,
        Labels: { maintainer: 'ops' },
      } as never,
      true
    );

    expect(vm.Id).toBe('sha256:aaa');
    expect(vm.Created).toBe(1700000000);
    expect(vm.RepoTags).toEqual(['nginx:latest', 'nginx:1.25']);
    expect(vm.Size).toBe(42_000_000);
    expect(vm.Labels).toEqual({ maintainer: 'ops' });
    expect(vm.Used).toBe(true);
    expect(vm.NodeName).toBe('');
  });

  it('synthesizes RepoTags from RepoDigests when tags are missing', () => {
    const vm = new ImageViewModel({
      Id: 'sha256:bbb',
      Created: 1,
      RepoTags: [],
      RepoDigests: [
        'docker.io/library/nginx@sha256:deadbeef',
        'ghcr.io/org/app@sha256:cafebabe',
      ],
      Size: 1,
      Labels: null,
    } as never);

    expect(vm.RepoTags).toEqual([
      'docker.io/library/nginx:<none>',
      'ghcr.io/org/app:<none>',
    ]);
    expect(vm.Used).toBe(false);
  });

  it('keeps an empty RepoTags list when digests are also absent', () => {
    const vm = new ImageViewModel({
      Id: 'sha256:ccc',
      Created: 1,
      RepoTags: null,
      Size: 0,
    } as never);

    expect(vm.RepoTags).toBeNull();
  });

  it('records the agent NodeName when present', () => {
    const vm = new ImageViewModel({
      Id: 'sha256:ddd',
      Created: 1,
      RepoTags: ['app:dev'],
      Size: 10,
      Portainer: { Agent: { NodeName: 'node-a' } },
    } as never);

    expect(vm.NodeName).toBe('node-a');
  });
});
