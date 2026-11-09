import { createElement, Fragment } from 'react';
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { waitFor as waitForDom } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { FeatureFlag, useFeatureFlag } from './useFeatureFlag';
import { withFeatureFlag } from './withFeatureFlag';
import { useRedirectFeatureFlag } from './useRedirectFeatureFlag';

const go = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useRouter: () => ({ stateService: { go } }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const W = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return <W>{children}</W>;
}

describe('feature flag hooks for local UI', () => {
  beforeEach(() => {
    go.mockReset();
    server.use(
      http.get('/api/settings/public', () =>
        HttpResponse.json({
          Features: { 'some-flag': true },
        })
      )
    );
  });

  it('useFeatureFlag selects the flag value from public settings', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useFeatureFlag('some-flag' as FeatureFlag, { onSuccess }),
      { wrapper: Wrapper }
    );
    await waitForDom(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(true);
  });

  it('withFeatureFlag hides children when the flag is off', async () => {
    server.use(
      http.get('/api/settings/public', () =>
        HttpResponse.json({ Features: { 'some-flag': false } })
      )
    );
    const Flagged = withFeatureFlag(() => <div>flagged</div>, 'some-flag' as FeatureFlag);
    const { container } = render(
      <Wrapper>
        <Flagged />
      </Wrapper>
    );
    await waitForDom(() => expect(container).toBeEmptyDOMElement());
  });

  it('withFeatureFlag shows children when the flag is on', async () => {
    const Flagged = withFeatureFlag(() => <div>flagged</div>, 'some-flag' as FeatureFlag);
    render(
      <Wrapper>
        <Flagged />
      </Wrapper>
    );
    await waitForDom(() => expect(screen.getByText('flagged')).toBeInTheDocument());
  });

  it('useRedirectFeatureFlag redirects when the flag is disabled', async () => {
    server.use(
      http.get('/api/settings/public', () =>
        HttpResponse.json({ Features: { 'some-flag': false } })
      )
    );
    renderHook(() => useRedirectFeatureFlag('some-flag' as FeatureFlag, 'home'), {
      wrapper: Wrapper,
    });
    await waitForDom(() => expect(go).toHaveBeenCalledWith('home'));
  });
});
