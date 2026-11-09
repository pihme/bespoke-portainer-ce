import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';

import { getBackupStatus } from './backup.service';

describe('REQ-BKP-01 getBackupStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the S3 backup status body on success', async () => {
    const body = { Failed: false, TimestampUTC: '2026-01-01T00:00:00Z' };
    server.use(http.get('/api/backup/s3/status', () => HttpResponse.json(body)));
    await expect(getBackupStatus()).resolves.toEqual(body);
  });

  it('wraps failures with a clear message', async () => {
    server.use(
      http.get('/api/backup/s3/status', () =>
        HttpResponse.json({ message: 'down' }, { status: 500 })
      )
    );
    await expect(getBackupStatus()).rejects.toThrow(/Unable to retrieve backup status/);
  });
});
