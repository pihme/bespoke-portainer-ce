import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  getContainerLogs,
  killContainer,
  pauseContainer,
  recreateContainer,
  removeContainer,
  renameContainer,
  restartContainer,
  resumeContainer,
  startContainer,
  stopContainer,
} from './containers.service';

describe('REQ-CTR-02 local container lifecycle helpers', () => {
  it('startContainer posts to the docker proxy start path', async () => {
    let method = '';
    let path = '';
    let agentHeader: string | null = null;
    server.use(
      http.post(
        '/api/endpoints/:id/docker/containers/:cid/start',
        ({ request, params }) => {
          method = request.method;
          path = `/api/endpoints/${params.id}/docker/containers/${params.cid}/start`;
          agentHeader = request.headers.get('X-PortainerAgent-Target');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    await expect(startContainer(1, 'c1')).resolves.toBeUndefined();
    expect(method).toBe('POST');
    expect(path).toContain('/containers/c1/start');
    expect(agentHeader).toBeNull();

    server.use(
      http.post(
        '/api/endpoints/:id/docker/containers/:cid/start',
        ({ request }) => {
          agentHeader = request.headers.get('X-PortainerAgent-Target');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );
    await startContainer(1, 'c1', { nodeName: 'node-a' });
    expect(agentHeader).toBe('node-a');
  });

  it('stopContainer, restartContainer, killContainer, pauseContainer and resumeContainer hit their proxy actions', async () => {
    const hits: string[] = [];
    server.use(
      http.post(
        '/api/endpoints/:id/docker/containers/:cid/:action',
        ({ params }) => {
          hits.push(String(params.action));
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    await stopContainer(2, 'c2');
    await restartContainer(2, 'c2', { nodeName: 'n1' });
    await killContainer(2, 'c2');
    await pauseContainer(2, 'c2');
    await resumeContainer(2, 'c2');

    expect(hits).toEqual(['stop', 'restart', 'kill', 'pause', 'unpause']);
  });

  it('lifecycle helpers surface parsed errors on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/containers/:cid/:action', () =>
        HttpResponse.json({ message: 'denied' }, { status: 500 })
      )
    );

    await expect(startContainer(1, 'c1')).rejects.toThrow(
      /Failed starting container|denied/i
    );
    await expect(stopContainer(1, 'c1')).rejects.toThrow(
      /Failed stopping container|denied/i
    );
    await expect(restartContainer(1, 'c1')).rejects.toThrow(
      /Failed restarting container|denied/i
    );
    await expect(killContainer(1, 'c1')).rejects.toThrow(
      /Failed killing container|denied/i
    );
    await expect(pauseContainer(1, 'c1')).rejects.toThrow(
      /Failed pausing container|denied/i
    );
    await expect(resumeContainer(1, 'c1')).rejects.toThrow(
      /Failed resuming container|denied/i
    );
    restore();
  });
});

describe('REQ-CTR-06 recreate and REQ-CTR-07 rename helpers', () => {
  it('recreateContainer posts PullImage to the docker recreate URL', async () => {
    let body: unknown;
    let url = '';
    server.use(
      http.post('/api/docker/:id/containers/:cid/recreate', async ({ request, params }) => {
        url = `/api/docker/${params.id}/containers/${params.cid}/recreate`;
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    await recreateContainer(3, 'c3', true, { nodeName: 'worker' });
    expect(url).toContain('/docker/3/containers/c3/recreate');
    expect(body).toEqual({ PullImage: true });

    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/docker/:id/containers/:cid/recreate', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    await expect(recreateContainer(3, 'c3', false)).rejects.toThrow(
      /Failed recreating container|nope/i
    );
    restore();
  });

  it('renameContainer posts the new name as a query param', async () => {
    let nameParam: string | null = null;
    server.use(
      http.post(
        '/api/endpoints/:id/docker/containers/:cid/rename',
        ({ request }) => {
          nameParam = new URL(request.url).searchParams.get('name');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    await renameContainer(4, 'c4', 'renamed');
    expect(nameParam).toBe('renamed');

    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/containers/:cid/rename', () =>
        HttpResponse.json({ message: 'taken' }, { status: 409 })
      )
    );
    await expect(renameContainer(4, 'c4', 'x')).rejects.toThrow(
      /Failed renaming container|taken/i
    );
    restore();
  });
});

describe('REQ-CTR-14 removeContainer and REQ-CTR-10 getContainerLogs', () => {
  it('removeContainer deletes with force and optional volume removal', async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.delete('/api/endpoints/:id/docker/containers/:cid', ({ request }) => {
        params = new URL(request.url).searchParams;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await removeContainer(5, 'c5');
    expect(params!.get('force')).toBe('true');
    expect(params!.get('v')).toBe('0');

    await removeContainer(5, 'c5', { removeVolumes: true, nodeName: 'n2' });
    expect(params!.get('v')).toBe('1');
  });

  it('removeContainer throws PortainerError when the proxy returns a message body', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:id/docker/containers/:cid', () =>
        HttpResponse.json({ message: 'still running' })
      )
    );
    await expect(removeContainer(5, 'c5')).rejects.toThrow(/still running/i);
    restore();
  });

  it('removeContainer surfaces transport errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:id/docker/containers/:cid', () =>
        HttpResponse.json({ message: 'gone' }, { status: 500 })
      )
    );
    await expect(removeContainer(5, 'c5')).rejects.toThrow(
      /Unable to remove container|gone/i
    );
    restore();
  });

  it('getContainerLogs returns log text and forwards params', async () => {
    let query = '';
    server.use(
      http.get('/api/endpoints/:id/docker/containers/:cid/logs', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.text('line1\nline2');
      })
    );

    await expect(
      getContainerLogs(6, 'c6', {
        stdout: true,
        stderr: false,
        timestamps: true,
        tail: 50,
      })
    ).resolves.toBe('line1\nline2');
    expect(query).toContain('stdout=true');
    expect(query).toContain('timestamps=true');
    expect(query).toContain('tail=50');
    // falsey stderr is dropped by pickBy
    expect(query).not.toContain('stderr');

    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/containers/:cid/logs', () =>
        HttpResponse.json({ message: 'no logs' }, { status: 500 })
      )
    );
    await expect(getContainerLogs(6, 'c6')).rejects.toThrow(
      /Unable to get container logs|no logs/i
    );
    restore();
  });
});
