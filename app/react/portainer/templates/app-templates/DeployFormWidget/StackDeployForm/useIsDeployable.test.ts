import { renderHook } from '@testing-library/react-hooks';

import { TemplateType } from '../../types';

import { useIsDeployable } from './useIsDeployable';

describe('REQ-TPL-01 useIsDeployable for local app templates', () => {
  it('always allows compose and container templates', () => {
    expect(
      renderHook(() => useIsDeployable(TemplateType.ComposeStack)).result
        .current
    ).toBe(true);
    expect(
      renderHook(() => useIsDeployable(TemplateType.Container)).result.current
    ).toBe(true);
  });

  it('REQ-TAI-003 never allows Docker Swarm stack templates', () => {
    expect(
      renderHook(() => useIsDeployable(TemplateType.SwarmStack)).result.current
    ).toBe(false);
  });

  it('rejects unknown template types', () => {
    expect(
      renderHook(() => useIsDeployable(99 as TemplateType)).result.current
    ).toBe(false);
  });
});
