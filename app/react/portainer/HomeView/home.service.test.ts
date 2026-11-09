import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/setup-tests/server';

import { getMotd } from './home.service';

describe('getMotd home service', () => {
  it('returns Motd payload for the local home view', async () => {
    server.use(
      http.get('/api/motd', () =>
        HttpResponse.json({
          Title: 'Hi',
          Message: 'msg',
          Hash: 'h1',
        })
      )
    );

    await expect(getMotd()).resolves.toEqual({
      Title: 'Hi',
      Message: 'msg',
      Hash: 'h1',
    });
  });

  it('wraps failures with a readable error', async () => {
    server.use(http.get('/api/motd', () => HttpResponse.json({}, { status: 500 })));

    await expect(getMotd()).rejects.toThrow(/Unable to retrieve information message/);
  });
});
