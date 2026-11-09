import { renderHook } from '@testing-library/react-hooks';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useValidation } from './useValidation';

vi.mock('@/react/portainer/templates/custom-templates/queries/useCustomTemplates', () => ({
  useCustomTemplates: () => ({ data: [{ Id: 1, Title: 'existing' }] }),
}));
vi.mock('@/react/portainer/custom-templates/components/CommonFields', () => ({
  validation: () => {
    const { object, string } = require('yup') as typeof import('yup');
    return object({
      Title: string().required(),
      Description: string().required(),
    });
  },
}));
vi.mock('@/react/portainer/custom-templates/components/CustomTemplatesVariablesDefinitionField', () => ({
  variablesValidation: () => {
    const { array } = require('yup') as typeof import('yup');
    return array();
  },
}));
vi.mock('@/react/portainer/gitops/GitForm', () => ({
  buildGitValidationSchema: () => {
    const { object } = require('yup') as typeof import('yup');
    return object({});
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-TPL-03 useValidation for editing local Compose templates', () => {
  it('requires FileContent for a docker compose edit', async () => {
    const { result } = renderHook(
      () =>
        useValidation({
          viewType: 'docker',
          isGit: false,
          templateId: 7,
          deployMethod: 'compose',
        }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 't',
        Description: 'd',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        FileContent: '',
        Variables: [],
      })
    ).rejects.toThrow(/Template is required/i);
  });

  it('accepts a filled local Compose template', async () => {
    const { result } = renderHook(
      () =>
        useValidation({
          viewType: 'docker',
          isGit: false,
          templateId: 7,
          deployMethod: 'compose',
        }),
      { wrapper }
    );

    await expect(
      result.current.validate({
        Title: 'nginx',
        Description: 'web',
        Platform: Platform.LINUX,
        Type: StackType.DockerCompose,
        FileContent: 'services: {}',
        Variables: [],
      })
    ).resolves.toBeTruthy();
  });
});
