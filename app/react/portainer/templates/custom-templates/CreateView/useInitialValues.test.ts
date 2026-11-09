import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { useInitialValues } from './useInitialValues';

const mockUseCurrentStateAndParams = vi.fn();
const mockUseAppTemplateFile = vi.fn();
const mockGetDefaultEdgeTemplateSettings = vi.fn();

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => mockUseCurrentStateAndParams(),
}));

vi.mock('../../app-templates/queries/useAppTemplateFile', () => ({
  useAppTemplateFile: (...args: unknown[]) => mockUseAppTemplateFile(...args),
}));

vi.mock('../types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../types')>();
  return {
    ...actual,
    getDefaultEdgeTemplateSettings: () => mockGetDefaultEdgeTemplateSettings(),
  };
});

describe('REQ-TPL-03 useInitialValues', () => {
  beforeEach(() => {
    mockUseCurrentStateAndParams.mockReset();
    mockUseAppTemplateFile.mockReset();
    mockGetDefaultEdgeTemplateSettings.mockReset();

    mockGetDefaultEdgeTemplateSettings.mockReturnValue({
      PrePullImage: false,
      RetryDeploy: false,
    });
    mockUseCurrentStateAndParams.mockReturnValue({
      params: {},
    });
    mockUseAppTemplateFile.mockReturnValue({
      data: undefined,
      isInitialLoading: false,
    });
  });

  it('returns undefined while an app template file is still loading', () => {
    mockUseAppTemplateFile.mockReturnValue({
      data: undefined,
      isInitialLoading: true,
    });
    mockUseCurrentStateAndParams.mockReturnValue({
      params: { appTemplateId: '12' },
    });

    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        buildMethods: ['editor', 'upload', 'repository'],
      })
    );

    expect(result.current).toBeUndefined();
    expect(mockUseAppTemplateFile).toHaveBeenCalledWith(12);
  });

  it('builds local compose defaults with compose file path', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        buildMethods: ['editor', 'upload', 'repository'],
      })
    );

    expect(result.current).toMatchObject({
      Title: '',
      FileContent: '',
      Type: StackType.DockerCompose,
      Platform: Platform.LINUX,
      Method: 'editor',
      Description: '',
      Note: '',
      Logo: '',
      Variables: [],
      Git: {
        SourceId: 0,
        RepositoryReferenceName: '',
        ComposeFilePathInRepository: 'docker-compose.yml',
        AdditionalFiles: [],
      },
      EdgeSettings: undefined,
    });
    // REQ-TAI-001: no ownership defaults
    expect(result.current).not.toHaveProperty('AccessControl');
    expect(mockGetDefaultEdgeTemplateSettings).not.toHaveBeenCalled();
  });

  it('prefers app template file content over router fileContent param', () => {
    mockUseCurrentStateAndParams.mockReturnValue({
      params: {
        appTemplateId: '5',
        type: String(StackType.DockerCompose),
        fileContent: 'from-router',
      },
    });
    mockUseAppTemplateFile.mockReturnValue({
      data: 'from-app-template',
      isInitialLoading: false,
    });

    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerSwarm,
        buildMethods: ['upload'],
      })
    );

    expect(result.current?.FileContent).toBe('from-app-template');
    expect(result.current?.Type).toBe(StackType.DockerCompose);
    expect(result.current?.Method).toBe('upload');
  });

  it('falls back to router fileContent when app template file is empty', () => {
    mockUseCurrentStateAndParams.mockReturnValue({
      params: { fileContent: 'router-compose' },
    });
    mockUseAppTemplateFile.mockReturnValue({
      data: '',
      isInitialLoading: false,
    });

    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        buildMethods: ['editor'],
      })
    );

    expect(result.current?.FileContent).toBe('router-compose');
  });

  it('REQ-TAI-002 ignores a Kubernetes template type param', () => {
    mockUseCurrentStateAndParams.mockReturnValue({
      params: { type: String(StackType.Kubernetes) },
    });

    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        buildMethods: ['editor'],
      })
    );

    expect(result.current?.Type).toBe(StackType.DockerCompose);
    expect(result.current?.Git.ComposeFilePathInRepository).toBe(
      'docker-compose.yml'
    );
  });

  it('sets edge settings for edge create', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        isEdge: true,
        buildMethods: ['editor'],
      })
    );

    expect(result.current?.EdgeSettings).toEqual({
      PrePullImage: false,
      RetryDeploy: false,
    });
    expect(mockGetDefaultEdgeTemplateSettings).toHaveBeenCalled();
  });

  it('ignores invalid type and appTemplateId query params', () => {
    mockUseCurrentStateAndParams.mockReturnValue({
      params: { type: 'not-a-number', appTemplateId: 'abc' },
    });

    const { result } = renderHook(() =>
      useInitialValues({
        defaultType: StackType.DockerCompose,
        buildMethods: ['repository'],
      })
    );

    expect(result.current?.Type).toBe(StackType.DockerCompose);
    expect(mockUseAppTemplateFile).toHaveBeenCalledWith(undefined);
    expect(result.current?.Method).toBe('repository');
  });
});
