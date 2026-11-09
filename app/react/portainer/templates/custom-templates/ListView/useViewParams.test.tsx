import { renderHook } from '@testing-library/react-hooks';

import { StackType } from '@/react/common/stacks/types';

import { useViewParams } from './useViewParams';

let viewType: 'docker' | 'kube' | 'edge' | 'other' = 'docker';
let dockerAuthorized = true;
let kubeAuthorized = true;

vi.mock('../useViewType', () => ({
  useViewType: () => viewType,
}));

vi.mock('@/react/hooks/useUser', () => ({
  useAuthorizations: (auth: string | string[]) => {
    if (auth === 'K8sApplicationsAdvancedDeploymentRW') {
      return { authorized: kubeAuthorized };
    }
    return { authorized: dockerAuthorized };
  },
}));

describe('REQ-TPL-03 useViewParams', () => {
  beforeEach(() => {
    viewType = 'docker';
    dockerAuthorized = true;
    kubeAuthorized = true;
  });

  it('returns docker compose params and deploy link when authorized', () => {
    const { result } = renderHook(() => useViewParams());

    expect(result.current.viewType).toBe('docker');
    expect(result.current.params).toEqual({
      edge: false,
      type: [StackType.DockerCompose, StackType.DockerSwarm],
    });
    expect(result.current.storageKey).toBe('docker-custom-templates');
    expect(result.current.getTemplateLinkParams?.({ Id: 9 } as never)).toEqual({
      to: '.',
      params: { template: 9 },
    });
  });

  it('omits docker deploy links when the user is not authorized', () => {
    dockerAuthorized = false;
    const { result } = renderHook(() => useViewParams());
    expect(result.current.getTemplateLinkParams).toBeUndefined();
  });

  it('returns kubernetes params when view type is kube', () => {
    viewType = 'kube';
    const { result } = renderHook(() => useViewParams());
    expect(result.current.params).toEqual({
      edge: false,
      type: [StackType.Kubernetes],
    });
    expect(result.current.storageKey).toBe('kube-custom-templates');
    expect(result.current.getTemplateLinkParams?.({ Id: 3 } as never)).toEqual({
      to: 'kubernetes.deploy',
      params: { templateId: 3, templateType: 'custom' },
    });
  });

  it('omits kube deploy links when unauthorized', () => {
    viewType = 'kube';
    kubeAuthorized = false;
    const { result } = renderHook(() => useViewParams());
    expect(result.current.getTemplateLinkParams).toBeUndefined();
  });

  it('returns edge params when view type is edge', () => {
    viewType = 'edge';
    const { result } = renderHook(() => useViewParams());
    expect(result.current.params).toEqual({ edge: true });
    expect(result.current.storageKey).toBe('edge-custom-templates');
    expect(result.current.getTemplateLinkParams?.({ Id: 4 } as never)).toEqual({
      to: 'edge.stacks.new',
      params: { templateId: 4, templateType: 'custom' },
    });
  });

  it('falls back to empty params for an unknown view type', () => {
    viewType = 'other';
    const { result } = renderHook(() => useViewParams());
    expect(result.current.params).toEqual({});
    expect(result.current.storageKey).toBe('custom-templates');
    expect(result.current.getTemplateLinkParams).toBeUndefined();
  });
});
