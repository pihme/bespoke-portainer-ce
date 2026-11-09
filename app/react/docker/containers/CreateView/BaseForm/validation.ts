import { boolean, object, SchemaOf, string } from 'yup';

import { imageConfigValidation } from '@@/ImageConfigFieldset';

import { Values } from './BaseForm';
import { validationSchema as portsSchema } from './PortsMappingField.validation';
import { nameValidation } from './NameField';

export function validation(
  {
    isDuplicating,
    isDuplicatingPortainer,
    isDockerhubRateLimited,
  }: {
    isDuplicating: boolean | undefined;
    isDuplicatingPortainer: boolean | undefined;
    isDockerhubRateLimited: boolean;
  } = {
    isDuplicating: false,
    isDuplicatingPortainer: false,
    isDockerhubRateLimited: false,
  }
): SchemaOf<Values> {
  return object({
    name: nameValidation().test(
      'not-duplicate-portainer',
      () => !isDuplicatingPortainer
    ),
    alwaysPull: boolean()
      .default(true)
      .test('rate-limits', 'Rate limit exceeded', (alwaysPull: boolean) =>
        alwaysPull ? !isDockerhubRateLimited : true
      ),
    autoRemove: boolean().default(false),
    enableWebhook: boolean().default(false),
    nodeName: string().default(''),
    ports: portsSchema(),
    publishAllPorts: boolean().default(false),
    image: imageConfigValidation().test(
      'duplicate-must-have-registry',
      'Duplicate is only possible when registry is selected',
      (value) => !isDuplicating || typeof value.registryId !== 'undefined'
    ),
  });
}
