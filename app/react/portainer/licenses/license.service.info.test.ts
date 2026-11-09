import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';

import { getLicenseInfo, resetState, subscribe } from './license.service';
import { Edition, LicenseType } from './types';

const info = {
  productEdition: Edition.CE,
  company: 'c',
  email: 'a@b.c',
  createdAt: 1,
  expiresAt: 2,
  nodes: 5,
  type: LicenseType.Essentials,
  valid: true,
  enforcedAt: 0,
  enforced: false,
};

describe('license info helpers (CE surface)', () => {
  beforeEach(() => {
    resetState();
  });

  it('fetches and caches license info', async () => {
    let hits = 0;
    server.use(
      http.get('/api/licenses/info', () => {
        hits += 1;
        return HttpResponse.json(info);
      })
    );

    const first = await getLicenseInfo();
    const second = await getLicenseInfo();
    expect(first).toEqual(info);
    expect(second).toEqual(info);
    expect(hits).toBe(1);
  });

  it('notifies subscribers when info is loaded', async () => {
    server.use(http.get('/api/licenses/info', () => HttpResponse.json(info)));
    const listener = vi.fn();
    subscribe(listener);
    await getLicenseInfo();
    expect(listener).toHaveBeenCalledWith(info);
  });
});
