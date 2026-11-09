import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { connectContainer } from './useConnectContainerMutation';
import { createNetwork } from './useCreateNetworkMutation';
import { deleteNetwork } from './useDeleteNetworkMutation';
import { disconnectContainer } from './useDisconnectContainerMutation';
import { getNetwork } from './useNetwork';
import { getNetworks } from './useNetworks';

describe('local Docker network API helpers', () => {
  it('lists networks and keeps all when no scope filter is set', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json([
          {
            Name: 'bridge',
            Id: '1',
            Driver: 'bridge',
            Scope: 'local',
            Attachable: false,
            Internal: false,
            Containers: {
              c1: {
                EndpointID: 'e',
                IPv4Address: '1.1.1.1',
                IPv6Address: '',
                MacAddress: 'aa',
                Name: 'c1',
              },
            },
            IPAM: {
              Driver: 'default',
              Config: [{ Subnet: '172.17.0.0/16', Gateway: '172.17.0.1' }],
              Options: {},
            },
            Options: {},
          },
          {
            Name: 'ingress',
            Id: '2',
            Driver: 'overlay',
            Scope: 'swarm',
            Attachable: true,
          },
        ])
      )
    );

    const all = await getNetworks(1, {});
    expect(all).toHaveLength(2);
    expect(all[0].Containers.c1.Name).toBe('c1');
    expect(all[0].IPAM.Config[0].Subnet).toBe('172.17.0.0/16');

    const localOnly = await getNetworks(1, { local: true });
    expect(localOnly.map((n) => n.Id)).toEqual(['1']);
  });

  it('maps missing IPAM and Containers to defaults', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json([
          { Name: undefined, Id: undefined, Driver: undefined, Scope: undefined },
        ])
      )
    );
    const [net] = await getNetworks(1, {});
    expect(net.Name).toBe('');
    expect(net.IPAM).toEqual({ Config: [], Driver: '', Options: {} });
    expect(net.Containers).toEqual({});
  });

  it('wraps list failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    await expect(getNetworks(1, {})).rejects.toThrow(
      'Unable to retrieve networks'
    );
    restore();
  });

  it('fetches a single network', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json({ Id: 'n1', Name: 'bridge' })
      )
    );
    await expect(getNetwork(1, 'n1', { nodeName: 'node-a' })).resolves.toEqual({
      Id: 'n1',
      Name: 'bridge',
    });
  });

  it('wraps getNetwork failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );
    await expect(getNetwork(1, 'missing')).rejects.toThrow(
      'Unable to retrieve network details'
    );
    restore();
  });

  it('creates a network', async () => {
    server.use(
      http.post('/api/endpoints/:id/docker/networks/create', () =>
        HttpResponse.json({ Id: 'created', Warning: '' })
      )
    );
    await expect(
      createNetwork(1, { Name: 'app-net', Driver: 'bridge' }, { nodeName: 'n1' })
    ).resolves.toEqual({ Id: 'created', Warning: '' });
  });

  it('wraps createNetwork failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/networks/create', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    await expect(createNetwork(1, { Name: 'x' })).rejects.toThrow(
      'Unable to create network'
    );
    restore();
  });

  it('deletes a network', async () => {
    server.use(
      http.delete('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json(null, { status: 204 })
      )
    );
    await expect(deleteNetwork(1, 'n1', { nodeName: 'node' })).resolves.toBe(
      'n1'
    );
  });

  it('wraps deleteNetwork failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json({ message: 'busy' }, { status: 500 })
      )
    );
    await expect(deleteNetwork(1, 'n1')).rejects.toThrow(
      'Unable to remove network'
    );
    restore();
  });

  it('connects a container with optional aliases', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(
        '/api/endpoints/:id/docker/networks/:networkId/connect',
        async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(null, { status: 200 });
        }
      )
    );
    await connectContainer({
      environmentId: 1,
      networkId: 'n1',
      containerId: 'c1',
      aliases: ['web'],
    });
    await connectContainer({
      environmentId: 1,
      networkId: 'n1',
      containerId: 'c2',
    });
    expect(bodies).toEqual([
      { Container: 'c1', EndpointConfig: { Aliases: ['web'] } },
      { Container: 'c2' },
    ]);
  });

  it('wraps connectContainer failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/networks/:networkId/connect', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(
      connectContainer({ environmentId: 1, networkId: 'n', containerId: 'c' })
    ).rejects.toThrow('Unable to connect container');
    restore();
  });

  it('disconnects a container', async () => {
    server.use(
      http.post(
        '/api/endpoints/:id/docker/networks/:networkId/disconnect',
        () => HttpResponse.json(null, { status: 200 })
      )
    );
    await expect(disconnectContainer(1, 'n1', 'c1', 'node')).resolves.toEqual({
      networkId: 'n1',
      environmentId: 1,
    });
  });

  it('wraps disconnectContainer failures', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post(
        '/api/endpoints/:id/docker/networks/:networkId/disconnect',
        () => HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(disconnectContainer(1, 'n1', 'c1')).rejects.toThrow(
      'Unable to disconnect container from network'
    );
    restore();
  });
});
