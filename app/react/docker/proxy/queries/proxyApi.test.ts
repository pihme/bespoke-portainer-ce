import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { commitContainer } from './useCommitContainerMutation';
import { getEvents } from './useEvents';
import { resizeTTY } from './useExecResizeTTYMutation';
import { getInfo } from './useInfo';
import { ping } from './usePing';
import { aggregateData, getPlugins } from './usePlugins';
import { getVersion } from './useVersion';
import { downloadImages } from './images/useDownloadImages';
import { getImage } from './images/useImage';
import { getImageHistory } from './images/useImageHistory';
import { getImages } from './images/useImages';
import { removeImage } from './images/useRemoveImageMutation';
import { tagImage } from './images/useTagImageMutation';
import { uploadImages } from './images/useUploadImageMutation';

describe('local Docker proxy API helpers (backwards compatibility)', () => {
  it('getInfo returns system info from the docker proxy', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/info', () =>
        HttpResponse.json({ OSType: 'linux', NCPU: 4, MemTotal: 2_000_000_000 })
      )
    );
    await expect(getInfo(1)).resolves.toMatchObject({ OSType: 'linux', NCPU: 4 });
  });

  it('getInfo surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/info', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    await expect(getInfo(1)).rejects.toThrow(/Unable to retrieve system info|boom/i);
    restore();
  });

  it('getVersion returns the engine version payload', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/version', () =>
        HttpResponse.json({ ApiVersion: '1.44', Version: '27.0.0' })
      )
    );
    await expect(getVersion(2)).resolves.toMatchObject({ ApiVersion: '1.44' });
  });

  it('getVersion surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/version', () =>
        HttpResponse.json({ message: 'down' }, { status: 500 })
      )
    );
    await expect(getVersion(2)).rejects.toThrow(/Unable to retrieve version|down/i);
    restore();
  });

  it('ping hits the _ping endpoint', async () => {
    let hit = false;
    server.use(
      http.get('/api/endpoints/:id/docker/_ping', () => {
        hit = true;
        return new HttpResponse('OK', { status: 200 });
      })
    );
    await expect(ping(3)).resolves.toBeUndefined();
    expect(hit).toBe(true);
  });

  it('ping surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/_ping', () =>
        HttpResponse.json({ message: 'unreachable' }, { status: 500 })
      )
    );
    await expect(ping(3)).rejects.toBeTruthy();
    restore();
  });

  it('getEvents returns NDJSON-parsed engine events with since/until params', async () => {
    let requestUrl = '';
    server.use(
      http.get('/api/endpoints/:id/docker/events', ({ request }) => {
        requestUrl = request.url;
        return new HttpResponse(
          '{"Type":"container","Action":"start"}\n{"Type":"image","Action":"pull"}',
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    const events = await getEvents(4, { since: 10, until: 20 });
    expect(events).toEqual([
      { Type: 'container', Action: 'start' },
      { Type: 'image', Action: 'pull' },
    ]);
    const url = new URL(requestUrl);
    expect(url.searchParams.get('since')).toBe('10');
    expect(url.searchParams.get('until')).toBe('20');
  });

  it('getEvents surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/events', () =>
        HttpResponse.json({ message: 'no events' }, { status: 500 })
      )
    );
    await expect(getEvents(4)).rejects.toThrow(/Unable to retrieve engine events|no events/i);
    restore();
  });

  it('getPlugins returns the plugin list', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/plugins', () =>
        HttpResponse.json([{ Name: 'rexray/s3fs', Enabled: true }])
      )
    );
    await expect(getPlugins(5)).resolves.toEqual([
      { Name: 'rexray/s3fs', Enabled: true },
    ]);
  });

  it('getPlugins surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/plugins', () =>
        HttpResponse.json({ message: 'plugins down' }, { status: 500 })
      )
    );
    await expect(getPlugins(5)).rejects.toThrow(/Unable to retrieve plugins|plugins down/i);
    restore();
  });

  it('commitContainer posts commit params and returns the image id', async () => {
    let requestUrl = '';
    server.use(
      http.post('/api/endpoints/:id/docker/commit', ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({ Id: 'sha256:new' });
      })
    );
    await expect(
      commitContainer(6, { container: 'c1', repo: 'myimg', tag: 'v1' })
    ).resolves.toEqual({ Id: 'sha256:new' });
    const url = new URL(requestUrl);
    expect(url.searchParams.get('container')).toBe('c1');
    expect(url.searchParams.get('repo')).toBe('myimg');
    expect(url.searchParams.get('tag')).toBe('v1');
  });

  it('commitContainer surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/commit', () =>
        HttpResponse.json({ message: 'commit failed' }, { status: 500 })
      )
    );
    await expect(commitContainer(6, { container: 'c1' })).rejects.toThrow(
      /Unable to commit container|commit failed/i
    );
    restore();
  });

  it('resizeTTY posts width and height query params', async () => {
    let requestUrl = '';
    server.use(
      http.post('/api/endpoints/:id/docker/exec/:execId/resize', ({ request }) => {
        requestUrl = request.url;
        return new HttpResponse(null, { status: 200 });
      })
    );
    await expect(resizeTTY(7, 'exec-1', { width: 120, height: 40 })).resolves.toBeUndefined();
    const url = new URL(requestUrl);
    expect(url.pathname).toContain('/exec/exec-1/resize');
    expect(url.searchParams.get('w')).toBe('120');
    expect(url.searchParams.get('h')).toBe('40');
  });

  it('resizeTTY surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/exec/:execId/resize', () =>
        HttpResponse.json({ message: 'resize failed' }, { status: 500 })
      )
    );
    await expect(resizeTTY(7, 'exec-1', { width: 1, height: 1 })).rejects.toThrow(
      /Unable to resize tty of exec|resize failed/i
    );
    restore();
  });

  it('getImages lists images from the docker proxy', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/images/json', () =>
        HttpResponse.json([{ Id: 'sha256:img', RepoTags: ['alpine:latest'] }])
      )
    );
    await expect(getImages(8)).resolves.toEqual([
      { Id: 'sha256:img', RepoTags: ['alpine:latest'] },
    ]);
  });

  it('getImages surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/images/json', () =>
        HttpResponse.json({ message: 'list failed' }, { status: 500 })
      )
    );
    await expect(getImages(8)).rejects.toThrow(/Unable to retrieve images|list failed/i);
    restore();
  });

  it('getImage returns image inspect JSON', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/images/:imageId/json', () =>
        HttpResponse.json({ Id: 'sha256:img', Architecture: 'amd64' })
      )
    );
    await expect(getImage(9, 'sha256:img')).resolves.toMatchObject({
      Id: 'sha256:img',
      Architecture: 'amd64',
    });
  });

  it('getImage surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/images/:imageId/json', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );
    await expect(getImage(9, 'missing')).rejects.toThrow(/Unable to retrieve image|missing/i);
    restore();
  });

  it('getImageHistory returns image layers', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/images/:imageId/history', () =>
        HttpResponse.json([{ Id: 'layer1', Size: 100, CreatedBy: 'FROM alpine' }])
      )
    );
    await expect(getImageHistory(10, 'sha256:img')).resolves.toEqual([
      { Id: 'layer1', Size: 100, CreatedBy: 'FROM alpine' },
    ]);
  });

  it('getImageHistory surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/images/:imageId/history', () =>
        HttpResponse.json({ message: 'history failed' }, { status: 500 })
      )
    );
    await expect(getImageHistory(10, 'sha256:img')).rejects.toThrow(
      /Unable to retrieve image layers|history failed/i
    );
    restore();
  });

  it('downloadImages uses tags when present and falls back to id for none tags', async () => {
    let requestUrl = '';
    server.use(
      http.get('/api/endpoints/:id/docker/images/get', ({ request }) => {
        requestUrl = request.url;
        return new HttpResponse(new Blob(['tar']), {
          headers: { 'Content-Type': 'application/x-tar' },
        });
      })
    );
    const blob = await downloadImages(11, [
      { id: 'sha256:a', tags: ['nginx:latest'] },
      { id: 'sha256:b', tags: ['<none>:<none>'] },
    ]);
    expect(blob).toBeTruthy();
    expect(requestUrl).toContain('names=nginx:latest');
    expect(requestUrl).toContain('names=sha256:b');
  });

  it('downloadImages surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id/docker/images/get', () =>
        HttpResponse.json({ message: 'export failed' }, { status: 500 })
      )
    );
    await expect(
      downloadImages(11, [{ id: 'sha256:a', tags: ['nginx:latest'] }])
    ).rejects.toThrow(/Unable to download images|export failed/i);
    restore();
  });

  it('removeImage deletes an image with optional force', async () => {
    let requestUrl = '';
    server.use(
      http.delete('/api/endpoints/:id/docker/images/:imageId', ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json([{ Untagged: 'nginx:latest' }]);
      })
    );
    await expect(removeImage(12, 'nginx:latest', true)).resolves.toEqual([
      { Untagged: 'nginx:latest' },
    ]);
    expect(new URL(requestUrl).searchParams.get('force')).toBe('true');
  });

  it('removeImage surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:id/docker/images/:imageId', () =>
        HttpResponse.json({ message: 'in use' }, { status: 409 })
      )
    );
    await expect(removeImage(12, 'nginx:latest')).rejects.toThrow(
      /Unable to remove image|in use/i
    );
    restore();
  });

  it('tagImage posts repo and tag params', async () => {
    let requestUrl = '';
    server.use(
      http.post('/api/endpoints/:id/docker/images/:imageId/tag', ({ request }) => {
        requestUrl = request.url;
        return new HttpResponse(null, { status: 201 });
      })
    );
    await tagImage(13, 'sha256:img', 'myrepo/img', 'v2');
    const url = new URL(requestUrl);
    expect(url.searchParams.get('repo')).toBe('myrepo/img');
    expect(url.searchParams.get('tag')).toBe('v2');
  });

  it('tagImage surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/images/:imageId/tag', () =>
        HttpResponse.json({ message: 'bad tag' }, { status: 400 })
      )
    );
    await expect(tagImage(13, 'sha256:img', 'bad')).rejects.toThrow(
      /Unable to tag image|bad tag/i
    );
    restore();
  });

  it('uploadImages posts the tar file with its content type', async () => {
    let contentType = '';
    server.use(
      http.post('/api/endpoints/:id/docker/images/load', async ({ request }) => {
        contentType = request.headers.get('Content-Type') || '';
        return new HttpResponse(null, { status: 200 });
      })
    );
    const file = new File(['tar-bytes'], 'images.tar', {
      type: 'application/x-tar',
    });
    await uploadImages(14, file);
    expect(contentType).toBe('application/x-tar');
  });

  it('uploadImages surfaces a parsed error on failure', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/images/load', () =>
        HttpResponse.json({ message: 'load failed' }, { status: 500 })
      )
    );
    const file = new File(['x'], 'images.tar', { type: 'application/x-tar' });
    await expect(uploadImages(14, file)).rejects.toThrow(
      /Unable to upload image|load failed/i
    );
    restore();
  });
});

describe('aggregateData (backwards compatibility)', () => {
  it('returns null until system plugins are available', () => {
    expect(aggregateData(undefined, [], true, 'Volume')).toBeNull();
  });

  it('returns only system plugins when systemOnly is true', () => {
    expect(
      aggregateData({ Volume: ['local'], Network: ['bridge'] }, [], true, 'Volume')
    ).toEqual(['local']);
  });

  it('merges enabled matching plugins with system plugins', () => {
    const plugins = [
      {
        Name: 'rexray/s3fs',
        Enabled: true,
        Config: {
          Interface: { Types: ['docker.volumedriver/1.0'] },
        },
      },
      {
        Name: 'disabled',
        Enabled: false,
        Config: {
          Interface: { Types: ['docker.volumedriver/1.0'] },
        },
      },
      {
        Name: 'wrong-type',
        Enabled: true,
        Config: {
          Interface: { Types: ['docker.logdriver/1.0'] },
        },
      },
    ] as never[];

    expect(
      aggregateData({ Volume: ['local'] }, plugins, false, 'Volume')
    ).toEqual(['local', 'rexray/s3fs']);
  });

  it('treats a missing system plugin list for the type as empty', () => {
    expect(aggregateData({}, [], true, 'Log')).toEqual([]);
  });
});
