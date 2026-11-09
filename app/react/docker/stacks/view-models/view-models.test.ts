import { describe, expect, it } from 'vitest';

import { StackStatus, StackType } from '@/react/common/stacks/types';

import { ExternalStackViewModel } from './external-stack';
import { StackViewModel } from './stack';
import { isExternalStack, isOrphanedStack, isRegularStack } from './utils';

function baseStack(overrides: Record<string, unknown> = {}) {
  return {
    Id: 1,
    Type: StackType.DockerCompose,
    Name: 'web',
    EndpointId: 1,
    SwarmId: '',
    Env: [{ name: 'A', value: '1' }],
    Option: { Prune: true, Force: false },
    IsComposeFormat: true,
    Status: StackStatus.Active,
    CreationDate: 10,
    CreatedBy: 'admin',
    UpdateDate: 20,
    UpdatedBy: 'admin',
    GitConfig: undefined,
    FromAppTemplate: false,
    AdditionalFiles: ['a.yml'],
    AutoUpdate: undefined,
    Webhook: 'wh',
    StackFileVersion: 2,
    PreviousDeploymentInfo: null,
    SupportRelativePath: true,
    FilesystemPath: '/data',
    ResourceControl: {
      Id: 5,
      ResourceId: 'web',
      Type: 1,
      AdministratorsOnly: true,
      Public: false,
      System: false,
      TeamAccesses: [],
      UserAccesses: [],
    },
    ...overrides,
  };
}

describe('local Compose stack view-models', () => {
  it('StackViewModel maps stack fields and resource control', () => {
    const vm = new StackViewModel(baseStack() as never);
    expect(vm.Name).toBe('web');
    expect(vm.Regular).toBe(true);
    expect(vm.External).toBe(false);
    expect(vm.Orphaned).toBe(false);
    expect(vm.Env).toEqual([{ name: 'A', value: '1' }]);
    expect(vm.ResourceControl?.Id).toBe(5);
    expect(vm.AdditionalFiles).toEqual(['a.yml']);
  });

  it('StackViewModel defaults env and skips zero resource control for orphaned stacks', () => {
    const vm = new StackViewModel(
      baseStack({
        Env: undefined,
        AdditionalFiles: undefined,
        AutoUpdate: undefined,
        ResourceControl: { Id: 0 },
      }) as never,
      true
    );
    expect(vm.Env).toEqual([]);
    expect(vm.ResourceControl).toBeUndefined();
    expect(vm.Regular).toBe(false);
    expect(vm.Orphaned).toBe(true);
    expect(vm.AdditionalFiles).toBeUndefined();
  });

  it('ExternalStackViewModel marks stacks as external', () => {
    const vm = new ExternalStackViewModel(
      'compose_web',
      StackType.DockerCompose,
      123
    );
    expect(vm.External).toBe(true);
    expect(vm.Name).toBe('compose_web');
    expect(vm.Type).toBe(StackType.DockerCompose);
    expect(vm.Id).toMatch(/^external-stack_/);
  });

  it('type guards distinguish regular orphaned and external stacks', () => {
    const regular = new StackViewModel(baseStack() as never);
    const orphaned = new StackViewModel(baseStack() as never, true);
    const external = new ExternalStackViewModel(
      'x',
      StackType.DockerCompose,
      1
    );

    expect(isRegularStack(regular)).toBe(true);
    expect(isOrphanedStack(orphaned)).toBe(true);
    expect(isExternalStack(external)).toBe(true);
    expect(isExternalStack(regular)).toBe(false);
    expect(isRegularStack(external)).toBe(false);
    expect(isOrphanedStack(regular)).toBe(false);
  });
});
