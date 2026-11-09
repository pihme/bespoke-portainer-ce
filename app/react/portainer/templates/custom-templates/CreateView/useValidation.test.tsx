import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

const mockUseCustomTemplates = vi.fn();

vi.mock('@/react/portainer/templates/custom-templates/queries/useCustomTemplates', () => ({
  useCustomTemplates: (...args: unknown[]) => mockUseCustomTemplates(...args),
}));

import { useValidation } from './useValidation';

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-TPL-03 / REQ-TPL-04 useValidation', () => {
  beforeEach(() => {
    mockUseCustomTemplates.mockReset();
    mockUseCustomTemplates.mockReturnValue({
      data: [{ Id: 1, Title: 'existing' }],
    });
  });

  it('requires FileContent when Method is editor', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 't',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'editor',
        FileContent: '',
        File: undefined,
        Git: {},
        Variables: [],
      })
    ).rejects.toThrow(/Template is required/i);
  });

  it('REQ-TAI-002 rejects the Kubernetes template type', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'k8s',
        Description: 'manifest',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.Kubernetes,
        Method: 'editor',
        FileContent: 'apiVersion: v1',
        File: undefined,
        Git: {},
        Variables: [],
      })
    ).rejects.toThrow(/Type must be one of/i);
  });

  it('accepts a local editor compose template with variables', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'nginx',
        Description: 'web',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'editor',
        FileContent: 'services:\n  web:\n    image: nginx',
        File: undefined,
        Git: {},
        Variables: [
          {
            name: 'IMAGE',
            label: 'Image',
            defaultValue: 'nginx',
            description: '',
          },
        ],
      })
    ).resolves.toBeTruthy();
  });

  it('requires a file when Method is upload', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'upload-tpl',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'upload',
        FileContent: '',
        File: undefined,
        Git: {},
        Variables: [],
      })
    ).rejects.toThrow();
  });

  it('accepts upload when a File is present', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'upload-tpl',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'upload',
        FileContent: '',
        File: new File(['services: {}'], 'compose.yml', {
          type: 'text/yaml',
        }),
        Git: {},
        Variables: [],
      })
    ).resolves.toBeTruthy();
  });

  it('requires git source and compose path for repository method', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'git-tpl',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'repository',
        FileContent: '',
        File: undefined,
        Git: {
          SourceId: 0,
          RepositoryReferenceName: '',
          ComposeFilePathInRepository: '',
          AdditionalFiles: [],
        },
        Variables: [],
      })
    ).rejects.toThrow();
  });

  it('accepts a repository payload with source and compose path', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'git-tpl',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'repository',
        FileContent: '',
        File: undefined,
        Git: {
          SourceId: 2,
          RepositoryReferenceName: 'refs/heads/main',
          ComposeFilePathInRepository: 'docker-compose.yml',
          AdditionalFiles: [],
        },
        Variables: [],
      })
    ).resolves.toBeTruthy();
  });

  it('rejects a duplicate title from existing custom templates', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'docker', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'existing',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'editor',
        FileContent: 'x',
        File: undefined,
        Git: {},
        Variables: [],
      })
    ).rejects.toThrow(/unique/i);
  });

  it('still builds a schema for edge view type', async () => {
    const { result } = renderHook(
      () => useValidation({ viewType: 'edge', deployMethod: 'compose' }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'edge-local',
        Description: 'd',
        Note: '',
        Logo: '',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        Method: 'editor',
        FileContent: 'services: {}',
        File: undefined,
        Git: {},
        Variables: [],
      })
    ).resolves.toBeTruthy();
  });
});
