import { renderHook } from '@testing-library/react-hooks';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { useInitialValues } from './useInitialValues';

const useCurrentUser = vi.fn();
const useIsEdgeAdmin = vi.fn();
const parseAccessControlFormData = vi.fn();

vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: () => useCurrentUser(),
  useIsEdgeAdmin: () => useIsEdgeAdmin(),
}));
vi.mock('@/react/portainer/access-control/utils', () => ({
  parseAccessControlFormData: (...args: unknown[]) =>
    parseAccessControlFormData(...args),
}));
vi.mock('@/react/portainer/gitops/types', () => ({
  toGitFormModel: () => ({ RepositoryURL: 'https://example.com/repo.git' }),
}));
vi.mock('@/react/portainer/access-control/models/ResourceControlViewModel', () => ({
  ResourceControlViewModel: class {
    constructor(public raw: unknown) {}
  },
}));

const baseTemplate = {
  Id: 7,
  Title: 'Nginx',
  Description: 'desc',
  Note: 'note',
  Logo: '',
  Platform: Platform.LINUX,
  Type: StackType.DockerCompose,
  Variables: [],
  EdgeTemplate: false,
  ProjectPath: '',
  EntryPoint: '',
  CreatedByUserId: 1,
  IsComposeFormat: false,
};

describe('REQ-TPL-03 useInitialValues for editing local Compose templates', () => {
  beforeEach(() => {
    useCurrentUser.mockReturnValue({ user: { Id: 1 } });
    useIsEdgeAdmin.mockReturnValue({ isAdmin: true, isLoading: false });
    parseAccessControlFormData.mockReturnValue({ ownership: 'administrators' });
  });

  it('returns undefined while admin status loads', () => {
    useIsEdgeAdmin.mockReturnValue({ isAdmin: false, isLoading: true });
    const { result } = renderHook(() =>
      useInitialValues({
        template: baseTemplate as never,
        templateFile: 'services: {}',
        isEdge: false,
      })
    );
    expect(result.current).toBeUndefined();
  });

  it('maps a local Compose template file into form values', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          ResourceControl: { Id: 9 },
        } as never,
        templateFile: 'services: {}',
        isEdge: false,
      })
    );
    expect(result.current).toMatchObject({
      Title: 'Nginx',
      FileContent: 'services: {}',
      Type: StackType.DockerCompose,
      AccessControl: { ownership: 'administrators' },
    });
    expect(parseAccessControlFormData).toHaveBeenCalled();
  });

  it('includes Git form data when the template is git-backed', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          GitConfig: { URL: 'https://example.com/repo.git' },
        } as never,
        templateFile: undefined,
        isEdge: false,
      })
    );
    expect(result.current?.FileContent).toBe('');
    expect(result.current?.Git).toEqual({
      RepositoryURL: 'https://example.com/repo.git',
    });
  });

  it('skips access control for edge templates', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          ResourceControl: { Id: 9 },
          EdgeSettings: { PrePullImage: false },
        } as never,
        templateFile: 'x',
        isEdge: true,
      })
    );
    expect(result.current?.AccessControl).toBeUndefined();
    expect(result.current?.EdgeSettings).toEqual({ PrePullImage: false });
  });
});
