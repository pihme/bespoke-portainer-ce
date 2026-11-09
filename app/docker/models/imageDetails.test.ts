import { describe, it, expect } from 'vitest';

import { ImageDetailsViewModel } from './imageDetails';

describe('REQ-IMG-06 ImageDetailsViewModel', () => {
  it('maps inspect metadata and Config fields for the details page', () => {
    const vm = new ImageDetailsViewModel({
      Id: 'sha256:img',
      Parent: 'sha256:parent',
      Created: '2024-03-01T00:00:00Z',
      RepoTags: ['app:1'],
      Size: 1000,
      DockerVersion: '24.0.0',
      Os: 'linux',
      Architecture: 'amd64',
      Author: 'dev',
      Config: {
        Cmd: ['/bin/app'],
        Entrypoint: ['/entrypoint.sh'],
        ExposedPorts: { '80/tcp': {}, '443/tcp': {} },
        Volumes: { '/data': {}, '/logs': {} },
        Env: ['PATH=/usr/bin', 'APP=1'],
        Labels: { version: '1' },
      },
    } as never);

    expect(vm.Id).toBe('sha256:img');
    expect(vm.Parent).toBe('sha256:parent');
    expect(vm.Created).toBe('2024-03-01T00:00:00Z');
    expect(vm.RepoTags).toEqual(['app:1']);
    expect(vm.Size).toBe(1000);
    expect(vm.DockerVersion).toBe('24.0.0');
    expect(vm.Os).toBe('linux');
    expect(vm.Architecture).toBe('amd64');
    expect(vm.Author).toBe('dev');
    expect(vm.Command).toEqual(['/bin/app']);
    expect(vm.Entrypoint).toEqual(['/entrypoint.sh']);
    expect(vm.ExposedPorts).toEqual(['80/tcp', '443/tcp']);
    expect(vm.Volumes).toEqual(['/data', '/logs']);
    expect(vm.Env).toEqual(['PATH=/usr/bin', 'APP=1']);
    expect(vm.Labels).toEqual({ version: '1' });
    expect(vm.Used).toBe(false);
  });

  it('defaults Config-derived fields when Config is absent', () => {
    const vm = new ImageDetailsViewModel({
      Id: 'sha256:bare',
      Parent: '',
      Created: '',
      RepoTags: [],
      Size: 0,
      DockerVersion: '',
      Os: '',
      Architecture: '',
      Author: '',
    } as never);

    expect(vm.Command).toBeUndefined();
    expect(vm.Entrypoint).toEqual(['']);
    expect(vm.ExposedPorts).toEqual([]);
    expect(vm.Volumes).toEqual([]);
    expect(vm.Env).toEqual([]);
    expect(vm.Labels).toBeUndefined();
  });

  it('treats empty ExposedPorts and Volumes objects as empty lists', () => {
    const vm = new ImageDetailsViewModel({
      Id: 'sha256:empty-cfg',
      Config: {
        Entrypoint: null,
        ExposedPorts: {},
        Volumes: {},
        Env: null,
      },
    } as never);

    expect(vm.Entrypoint).toEqual(['']);
    expect(vm.ExposedPorts).toEqual([]);
    expect(vm.Volumes).toEqual([]);
    expect(vm.Env).toEqual([]);
  });
});
