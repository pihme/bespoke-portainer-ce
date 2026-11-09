import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { useViewType } from './useViewType';

const useCurrentStateAndParams = vi.fn();

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => useCurrentStateAndParams(),
}));

describe('REQ-TPL-03 useViewType', () => {
  it('detects docker, kube and edge view types', () => {
    useCurrentStateAndParams.mockReturnValue({
      state: { name: 'docker.templates.custom' },
    });
    expect(renderHook(() => useViewType()).result.current).toBe('docker');

    useCurrentStateAndParams.mockReturnValue({
      state: { name: 'kubernetes.templates.custom' },
    });
    expect(renderHook(() => useViewType()).result.current).toBe('kube');

    useCurrentStateAndParams.mockReturnValue({
      state: { name: 'edge.templates.custom' },
    });
    expect(renderHook(() => useViewType()).result.current).toBe('edge');
  });

  it('throws for unknown views', () => {
    useCurrentStateAndParams.mockReturnValue({ state: { name: 'other' } });
    const { result } = renderHook(() => useViewType());
    expect(result.error).toEqual(expect.objectContaining({ message: expect.stringMatching(/Unknown view type/) }));
  });
});
