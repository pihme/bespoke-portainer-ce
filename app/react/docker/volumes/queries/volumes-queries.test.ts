import { http, HttpResponse } from 'msw';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { buildUrl } from './build-url';
import { queryKeys } from './query-keys';
import { createVolume } from './useCreateVolume';
import { createVolume as createVolumeWithNode } from './useCreateVolumeMutation';
import { removeVolume } from './useRemoveVolumeMutation';
import { getVolume } from './useVolume';
import { getVolumes, useVolumes } from './useVolumes';

function wrapHook<T>(fn: () => T) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(fn, { wrapper: Wrapper });
}

describe('REQ-VOL local volume queries', () => {
  it('builds urls and query keys', () => {
    expect(buildUrl(1)).toBe('/endpoints/1/docker/volumes');
    expect(buildUrl(1, { id: 'v', action: 'x' })).toBe(
      '/endpoints/1/docker/volumes/v/x'
    );
    expect(queryKeys.base(1)).toEqual(expect.arrayContaining(['volumes']));
  });

  it('lists creates gets and removes local volumes', async () => {
    server.use(
      http.get('/api/endpoints/1/docker/volumes', () =>
        HttpResponse.json({ Volumes: [{ Name: 'data', Driver: 'local' }] })
      ),
      http.get('/api/endpoints/1/docker/volumes/:name', ({ params }) =>
        HttpResponse.json({ Name: params.name, Driver: 'local' })
      ),
      http.post('/api/endpoints/1/docker/volumes/create', () =>
        HttpResponse.json({ Name: 'new', Driver: 'local' })
      ),
      http.delete('/api/endpoints/1/docker/volumes/:name', () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    expect(await getVolumes(1)).toEqual([{ Name: 'data', Driver: 'local' }]);
    expect((await getVolume(1, 'data')).Name).toBe('data');
    expect((await createVolume(1, { Name: 'new' })).Name).toBe('new');
    expect(
      (await createVolumeWithNode(1, { Name: 'n2' }, { nodeName: 'node-a' })).Name
    ).toBe('new');
    await removeVolume(1, 'data', { nodeName: 'node-a' });

    const { result } = wrapHook(() => useVolumes(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].Name).toBe('data');
  });

  it('surfaces list errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/1/docker/volumes', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      )
    );
    await expect(getVolumes(1)).rejects.toBeTruthy();
    restore();
  });
});
