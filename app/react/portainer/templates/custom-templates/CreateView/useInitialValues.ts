import { useCurrentStateAndParams } from '@uirouter/react';

import { StackType } from '@/react/common/stacks/types';

import { Platform } from '../../types';
import { useAppTemplateFile } from '../../app-templates/queries/useAppTemplateFile';

import { FormValues, Method } from './types';

export function useInitialValues({
  defaultType,
  buildMethods,
}: {
  defaultType: StackType;
  buildMethods: Array<Method>;
}): FormValues | undefined {
  const { appTemplateId, type = defaultType } = useAppTemplateParams();

  const initialFilePathInRepository = 'docker-compose.yml';

  const {
    params: { fileContent = '' },
  } = useCurrentStateAndParams();

  const fileContentQuery = useAppTemplateFile(appTemplateId);
  if (fileContentQuery.isInitialLoading) {
    return undefined;
  }

  return {
    Title: '',
    FileContent: (fileContentQuery.data ?? '') || fileContent,
    Type: type,
    Platform: Platform.LINUX,
    File: undefined,
    Method: buildMethods[0],
    Description: '',
    Note: '',
    Logo: '',
    Variables: [],
    Git: {
      SourceId: 0,
      RepositoryReferenceName: '',
      ComposeFilePathInRepository: initialFilePathInRepository,
      AdditionalFiles: [],
    },
  };
}

function useAppTemplateParams() {
  const {
    params: { type, appTemplateId },
  } = useCurrentStateAndParams();

  return {
    type: getStackType(type),
    appTemplateId: getTemplateId(appTemplateId),
  };

  function getStackType(type: string): StackType | undefined {
    if (!type) {
      return undefined;
    }

    const typeNum = parseInt(type, 10);

    if (
      [StackType.DockerSwarm, StackType.DockerCompose].includes(typeNum)
    ) {
      return typeNum;
    }

    return undefined;
  }

  function getTemplateId(appTemplateId: string): number | undefined {
    const id = parseInt(appTemplateId, 10);

    return Number.isNaN(id) ? undefined : id;
  }
}
