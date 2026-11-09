import { object, array, number, mixed, SchemaOf, bool } from 'yup';

import { EnvironmentId } from '@/react/portainer/environments/types';
import { nameValidation } from '@/react/docker/stacks/common/NameField';
import { Stack } from '@/react/common/stacks/types';

import { envVarValidation } from '@@/form-components/EnvironmentVariablesFieldset';

import { BaseFormValues, FormValues } from './types';
import { getEditorValidationSchema } from './EditorSection/validation';
import { getGitValidationSchema } from './GitSection/validation';
import { getTemplateValidationSchema } from './TemplateSection/validation';
import { getUploadValidationSchema } from './UploadSection/validation';

export function getValidationSchema({
  environmentId,
  stacks,
  containerNames = [],
}: {
  environmentId: EnvironmentId;
  stacks?: Array<Stack>;
  containerNames?: Array<string>;
}): SchemaOf<FormValues> {
  return getBaseValidationSchema({ environmentId, stacks }).concat(
    object({
      git: getGitValidationSchema().when('method', {
        is: 'repository',
        then: (schema) => schema.required(),
        otherwise: () => mixed(),
      }),
      upload: getUploadValidationSchema({ containerNames }).when('method', {
        is: 'upload',
        then: (schema) => schema.required(),
        otherwise: () => mixed(),
      }),
      editor: getEditorValidationSchema({ containerNames }).when('method', {
        is: 'editor',
        then: (schema) => schema.required(),
        otherwise: () => mixed(),
      }),
      template: getTemplateValidationSchema({ containerNames }).when('method', {
        is: 'template',
        then: (schema) => schema.required(),
        otherwise: () => mixed(),
      }),
    })
  );
}

function getBaseValidationSchema({
  environmentId,
  stacks,
}: {
  environmentId: EnvironmentId;
  stacks?: Array<Stack>;
}): SchemaOf<BaseFormValues> {
  return object({
    method: mixed<'editor' | 'upload' | 'repository' | 'template'>()
      .oneOf(['editor', 'repository', 'template', 'upload'])
      .default('editor'),
    name: nameValidation({ environmentId, stacks }).required(
      'Stack name is required'
    ),
    env: envVarValidation(),
    enableWebhook: bool().default(false),
    registries: array(number().required()).default([]),
  });
}
