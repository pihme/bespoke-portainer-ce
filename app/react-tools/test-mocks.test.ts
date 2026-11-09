import { describe, expect, it } from 'vitest';

import { Role } from '@/portainer/users/types';
import { StackType, StackStatus } from '@/react/common/stacks/types';
import { ContainerEngine } from '@/react/portainer/environments/types';

import {
  createMockContainer,
  createMockEnvironment,
  createMockEnvironmentGroup,
  createMockQueryResult,
  createMockResourceGroups,
  createMockStack,
  createMockSubscriptions,
  createMockTeams,
  createMockUser,
  createMockUsers,
} from './test-mocks';

describe('test-mocks local Docker helpers', () => {
  it('createMockUser applies defaults and ThemeSettings overrides', () => {
    const user = createMockUser({
      Username: 'admin',
      Role: Role.Admin,
      ThemeSettings: { color: 'dark', subtleUpgradeButton: true },
    });
    expect(user.Id).toBe(1);
    expect(user.Username).toBe('admin');
    expect(user.Role).toBe(Role.Admin);
    expect(user.ThemeSettings).toEqual({
      color: 'dark',
      subtleUpgradeButton: true,
    });
  });

  it('createMockUsers distributes roles from a single role, array, or function', () => {
    expect(createMockUsers(2, Role.Admin).map((u) => u.Role)).toEqual([
      Role.Admin,
      Role.Admin,
    ]);
    expect(
      createMockUsers(3, [Role.Admin, Role.Standard]).map((u) => u.Role)
    ).toEqual([Role.Admin, Role.Standard, Role.Admin]);
    expect(
      createMockUsers(2, (id) => (id === 1 ? Role.Admin : Role.Standard)).map(
        (u) => u.Role
      )
    ).toEqual([Role.Admin, Role.Standard]);
    expect(() => createMockUsers(1, [])).toThrow('No roles provided');
  });

  it('createMockTeams builds sequential team ids and names', () => {
    expect(createMockTeams(2)).toEqual([
      { Id: 1, Name: 'team1' },
      { Id: 2, Name: 'team2' },
    ]);
  });

  it('createMockEnvironment defaults to a local Docker endpoint', () => {
    const env = createMockEnvironment({ Name: 'local', Id: 9 });
    expect(env.ContainerEngine).toBe(ContainerEngine.Docker);
    expect(env.Name).toBe('local');
    expect(env.Id).toBe(9);
    expect(env.Type).toBe(1);
  });

  it('createMockEnvironmentGroup applies overrides', () => {
    expect(
      createMockEnvironmentGroup({ Name: 'devs', Description: 'team' })
    ).toEqual({ Id: 1, Name: 'devs', Description: 'team' });
  });

  it('createMockStack defaults to an active compose stack', () => {
    const stack = createMockStack({ Name: 'web' });
    expect(stack.Type).toBe(StackType.DockerCompose);
    expect(stack.Status).toBe(StackStatus.Active);
    expect(stack.Name).toBe('web');
    expect(stack.IsComposeFormat).toBe(true);
  });

  it('createMockContainer merges container inspect defaults', () => {
    const container = createMockContainer({
      Name: '/nginx',
      State: { Status: 'exited', Running: false },
    });
    expect(container.Name).toBe('/nginx');
    expect(container.State.Status).toBe('exited');
    expect(container.State.Running).toBe(false);
    expect(container.Config.Image).toBe('nginx:latest');
  });

  it('createMockQueryResult builds a successful observer result', async () => {
    const result = createMockQueryResult({ ok: true }, { isFetching: true });
    expect(result.data).toEqual({ ok: true });
    expect(result.isSuccess).toBe(true);
    expect(result.isFetching).toBe(true);
    expect(result.status).toBe('success');
    await expect(result.refetch()).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(() => result.remove()).not.toThrow();
  });

  it('createMockSubscriptions and createMockResourceGroups build Azure-shaped lists', () => {
    expect(createMockSubscriptions(2).value).toEqual([
      {
        id: '/subscriptions/subscription-1',
        subscriptionId: 'subscription-1',
      },
      {
        id: '/subscriptions/subscription-2',
        subscriptionId: 'subscription-2',
      },
    ]);
    expect(createMockResourceGroups('sub-1', 1).value).toEqual([
      {
        id: '/subscriptions/sub-1/resourceGroups/resourceGroup-1',
        name: 'resourcegroup-1',
      },
    ]);
  });
});
