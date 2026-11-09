import { renderHook } from '@testing-library/react-hooks';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { useInitialValues } from './useInitialValues';

vi.mock('@/react/portainer/gitops/types', () => ({
  toGitFormModel: () => ({ RepositoryURL: 'https://example.com/repo.git' }),
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
  it('maps a local Compose template file into form values', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          ResourceControl: { Id: 9 },
        } as never,
        templateFile: 'services: {}',
      })
    );
    expect(result.current).toMatchObject({
      Title: 'Nginx',
      FileContent: 'services: {}',
      Type: StackType.DockerCompose,
    });
    // REQ-TAI-001: no ownership is carried into the edit form
    expect(result.current).not.toHaveProperty('AccessControl');
  });

  it('includes Git form data when the template is git-backed', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          GitConfig: { URL: 'https://example.com/repo.git' },
        } as never,
        templateFile: undefined,
      })
    );
    expect(result.current?.FileContent).toBe('');
    expect(result.current?.Git).toEqual({
      RepositoryURL: 'https://example.com/repo.git',
    });
  });

  it('keeps edge settings for edge templates', () => {
    const { result } = renderHook(() =>
      useInitialValues({
        template: {
          ...baseTemplate,
          ResourceControl: { Id: 9 },
          EdgeSettings: { PrePullImage: false },
        } as never,
        templateFile: 'x',
      })
    );
    expect(result.current?.EdgeSettings).toEqual({ PrePullImage: false });
  });
});
