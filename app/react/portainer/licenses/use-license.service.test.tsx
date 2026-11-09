import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { resetState } from './license.service';
import { useIntegratedLicenseInfo, useLicenseInfo } from './use-license.service';
import { Edition, LicenseType } from './types';

function wrapHook<T>(fn: () => T) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(fn, { wrapper: Wrapper });
}

describe('useLicenseInfo CE surface', () => {
  beforeEach(() => {
    resetState();
  });

  it('loads license info', async () => {
    server.use(
      http.get('/api/licenses/info', () =>
        HttpResponse.json({
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
        })
      ),
      http.get('/api/system/nodes', () => HttpResponse.json({ nodes: 2 }))
    );

    const { result } = wrapHook(() => useLicenseInfo());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.info?.nodes).toBe(5);

    const integrated = wrapHook(() => useIntegratedLicenseInfo());
    await waitFor(() => expect(integrated.result.current).not.toBeNull());
    expect(integrated.result.current?.usedNodes).toBe(2);
  });

  it('returns null integrated info for trial licenses', async () => {
    server.use(
      http.get('/api/licenses/info', () =>
        HttpResponse.json({
          productEdition: Edition.CE,
          company: 'c',
          email: 'a@b.c',
          createdAt: 1,
          expiresAt: 2,
          nodes: 1,
          type: LicenseType.Trial,
          valid: true,
          enforcedAt: 0,
          enforced: false,
        })
      ),
      http.get('/api/system/nodes', () => HttpResponse.json({ nodes: 1 }))
    );
    const { result } = wrapHook(() => useIntegratedLicenseInfo());
    await waitFor(() => expect(result.current).toBeNull());
  });
});
