import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EnvironmentId } from '@/react/portainer/environments/types';
import { Pair } from '@/react/portainer/settings/types';
import {
  GitFormModel,
  RelativePathModel,
} from '@/react/portainer/gitops/types';
import { withError, withInvalidate } from '@/react-tools/react-query';
import { transformAutoUpdateViewModel } from '@/react/portainer/gitops/AutoUpdateFieldset/utils';
import { RegistryId } from '@/react/portainer/registries/types/registry';

import { queryKeys } from '../query-keys';

import { createSwarmStackFromFile } from './createSwarmStackFromFile';
import { createSwarmStackFromGit } from './createSwarmStackFromGit';
import { createSwarmStackFromFileContent } from './createSwarmStackFromFileContent';
import { createStandaloneStackFromFile } from './createStandaloneStackFromFile';
import { createStandaloneStackFromGit } from './createStandaloneStackFromGit';
import { createStandaloneStackFromFileContent } from './createStandaloneStackFromFileContent';

export function useCreateStack() {
  const queryClient = useQueryClient();
  return useMutation(createStack, {
    ...withError('Failed to create stack'),
    ...withInvalidate(queryClient, [queryKeys.base()]),
  });
}

type BasePayload = {
  name: string;
  environmentId: EnvironmentId;
  registries?: Array<RegistryId>;
};

type DockerBasePayload = BasePayload & {
  env?: Array<Pair>;
};

type SwarmBasePayload = DockerBasePayload & {
  swarmId: string;
};

export type SwarmCreatePayload =
  | {
      method: 'file';
      payload: SwarmBasePayload & {
        /** File to upload */
        file: File;
        /** Optional webhook configuration */
        webhook?: string;
      };
    }
  | {
      method: 'string';
      payload: SwarmBasePayload & {
        /** Content of the Stack file */
        fileContent: string;
        /** Optional webhook configuration */
        webhook?: string;
        fromAppTemplate?: boolean;
      };
    }
  | {
      method: 'git';
      payload: SwarmBasePayload & {
        git: GitFormModel;
        relativePathSettings?: RelativePathModel;
        fromAppTemplate?: boolean;
        webhook?: string;
      };
    };

type StandaloneCreatePayload =
  | {
      method: 'file';
      payload: DockerBasePayload & {
        /** File to upload */
        file: File;
        /** Optional webhook configuration */
        webhook?: string;
      };
    }
  | {
      method: 'string';
      payload: DockerBasePayload & {
        /** Content of the Stack file */
        fileContent: string;
        /** Optional webhook configuration */
        webhook?: string;
        fromAppTemplate?: boolean;
      };
    }
  | {
      method: 'git';
      payload: DockerBasePayload & {
        git: GitFormModel;
        relativePathSettings?: RelativePathModel;
        fromAppTemplate?: boolean;
        webhook?: string;
      };
    };

export type CreateStackPayload =
  | ({ type: 'swarm' } & SwarmCreatePayload)
  | ({ type: 'standalone' } & StandaloneCreatePayload);

function createStack(payload: CreateStackPayload) {
  return createActualStack(payload);
}

function createActualStack(payload: CreateStackPayload) {
  switch (payload.type) {
    case 'swarm':
      return createSwarmStack(payload);
    case 'standalone':
      return createStandaloneStack(payload);
    default:
      throw new Error('Invalid type');
  }
}

function createSwarmStack({ method, payload }: SwarmCreatePayload) {
  switch (method) {
    case 'file':
      return createSwarmStackFromFile({
        environmentId: payload.environmentId,
        file: payload.file,
        Name: payload.name,
        SwarmID: payload.swarmId,
        Env: payload.env,
        Webhook: payload.webhook,
        Registries: payload.registries,
      });
    case 'git':
      return createSwarmStackFromGit({
        name: payload.name,
        env: payload.env,
        repositoryUrl: payload.git.RepositoryURL,
        repositoryReferenceName: payload.git.RepositoryReferenceName,
        composeFile: payload.git.ComposeFilePathInRepository,
        filesystemPath: payload.relativePathSettings?.FilesystemPath,
        supportRelativePath: payload.relativePathSettings?.SupportRelativePath,
        sourceId: payload.git.SourceId,
        autoUpdate: transformAutoUpdateViewModel(
          payload.git.AutoUpdate,
          payload.webhook
        ),
        environmentId: payload.environmentId,
        swarmID: payload.swarmId,
        additionalFiles: payload.git.AdditionalFiles,
        fromAppTemplate: payload.fromAppTemplate,
        registries: payload.registries,
      });
    case 'string':
      return createSwarmStackFromFileContent({
        name: payload.name,
        env: payload.env,
        environmentId: payload.environmentId,
        stackFileContent: payload.fileContent,
        webhook: payload.webhook,
        swarmID: payload.swarmId,
        fromAppTemplate: payload.fromAppTemplate,
        registries: payload.registries,
      });
    default:
      throw new Error('Invalid method');
  }
}

function createStandaloneStack({ method, payload }: StandaloneCreatePayload) {
  switch (method) {
    case 'file':
      return createStandaloneStackFromFile({
        environmentId: payload.environmentId,
        file: payload.file,
        Name: payload.name,
        Env: payload.env,
        Webhook: payload.webhook,
        Registries: payload.registries,
      });
    case 'git':
      return createStandaloneStackFromGit({
        name: payload.name,
        env: payload.env,
        repositoryUrl: payload.git.RepositoryURL,
        repositoryReferenceName: payload.git.RepositoryReferenceName,
        composeFile: payload.git.ComposeFilePathInRepository,
        filesystemPath: payload.relativePathSettings?.FilesystemPath,
        supportRelativePath: payload.relativePathSettings?.SupportRelativePath,
        sourceId: payload.git.SourceId,
        autoUpdate: transformAutoUpdateViewModel(
          payload.git.AutoUpdate,
          payload.webhook
        ),
        environmentId: payload.environmentId,
        additionalFiles: payload.git.AdditionalFiles,
        fromAppTemplate: payload.fromAppTemplate,
        registries: payload.registries,
      });
    case 'string':
      return createStandaloneStackFromFileContent({
        name: payload.name,
        env: payload.env,
        environmentId: payload.environmentId,
        stackFileContent: payload.fileContent,
        webhook: payload.webhook,
        fromAppTemplate: payload.fromAppTemplate,
        registries: payload.registries,
      });
    default:
      throw new Error('Invalid method');
  }
}
