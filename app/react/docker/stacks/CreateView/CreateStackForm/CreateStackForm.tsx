import { Formik } from 'formik';
import { useCurrentStateAndParams, useRouter } from '@uirouter/react';
import { useState } from 'react';
import uuidv4 from 'uuid/v4';

import { EnvironmentId } from '@/react/portainer/environments/types';
import {
  useCreateStack,
  CreateStackPayload,
} from '@/react/common/stacks/queries/useCreateStack/useCreateStack';
import { getDefaultModel } from '@/react/portainer/gitops/types';
import { notifySuccess } from '@/portainer/services/notifications';

import { FormValues } from './types';
import { useValidationSchema } from './useValidationSchema';
import { CreateStackInnerForm } from './CreateStackInnerForm';

interface Props {
  environmentId: EnvironmentId;
}

export function CreateStackForm({ environmentId }: Props) {
  const router = useRouter();
  const {
    params: { yaml },
  } = useCurrentStateAndParams();
  const createStackMutation = useCreateStack();
  const [webhookId] = useState(() => uuidv4());
  const validationSchema = useValidationSchema(environmentId);

  const initialValues: FormValues = {
    method: 'editor',
    name: '',
    editor: {
      fileContent: yaml || '',
    },
    upload: {
      file: null,
    },
    git: {
      ...getDefaultModel(),
      SupportRelativePath: false,
      FilesystemPath: '',
    },
    template: {
      fileContent: '',
      selectedId: undefined,
      variables: [],
    },
    env: [],
    enableWebhook: false,
    registries: [],
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={handleSubmit}
      validationSchema={validationSchema}
      validateOnMount
    >
      <CreateStackInnerForm
        isDeploying={createStackMutation.isLoading}
        isSaved={createStackMutation.isSuccess}
        webhookId={webhookId}
      />
    </Formik>
  );

  async function handleSubmit(values: FormValues) {
    const payload = buildCreateStackPayload({
      values,
      environmentId,
      webhookId,
    });

    createStackMutation.mutate(payload, {
      onSuccess: (stack) => {
        notifySuccess('Success', 'Stack successfully created');
        router.stateService.go('docker.stacks.stack', {
          name: stack.Name,
          id: stack.Id,
          type: stack.Type,
          regular: 'true',
        });
      },
    });
  }
}

function buildCreateStackPayload({
  environmentId,
  values,
  webhookId,
}: {
  values: FormValues;
  environmentId: EnvironmentId;
  webhookId: string;
}): CreateStackPayload {
  const basePayload = {
    name: values.name,
    environmentId,
    env: values.env,
    registries: values.registries,
  };

  switch (values.method) {
    case 'editor':
      return {
        type: 'standalone',
        method: 'string',
        payload: {
          ...basePayload,
          fileContent: values.editor.fileContent,
          webhook: values.enableWebhook ? webhookId : undefined,
        },
      };

    case 'upload':
      if (!values.upload.file) {
        throw new Error('File is required for upload method');
      }
      return {
        type: 'standalone',
        method: 'file',
        payload: {
          ...basePayload,
          file: values.upload.file,
          webhook: values.enableWebhook ? webhookId : undefined,
        },
      };

    case 'repository':
      return {
        type: 'standalone',
        method: 'git',
        payload: {
          ...basePayload,
          git: values.git,
          webhook: webhookId,
          relativePathSettings: values.git.SupportRelativePath
            ? {
                SupportRelativePath: true,
                FilesystemPath: values.git.FilesystemPath,
                SupportPerDeviceConfigs: false,
                PerDeviceConfigsPath: '',
                PerDeviceConfigsMatchType: '',
                PerDeviceConfigsGroupMatchType: '',
              }
            : undefined,
        },
      };

    case 'template':
      return {
        type: 'standalone',
        method: 'string',
        payload: {
          ...basePayload,
          fileContent: values.template.fileContent,
          webhook: values.enableWebhook ? webhookId : undefined,
          fromAppTemplate: true,
        },
      };

    default:
      throw new Error('Invalid method');
  }
}
