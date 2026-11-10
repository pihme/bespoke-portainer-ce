import { boolean, object, SchemaOf, string } from 'yup';

import { imageConfigValidation } from '@@/ImageConfigFieldset';

import { Values } from './BaseForm';
import { validationSchema as portsSchema } from './PortsMappingField.validation';
import { nameValidation } from './NameField';

export function validation(
  {
    isDuplicatingPortainer,
  }: {
    isDuplicating?: boolean | undefined;
    isDuplicatingPortainer: boolean | undefined;
  } = {
    isDuplicating: false,
    isDuplicatingPortainer: false,
  }
): SchemaOf<Values> {
  return object({
    name: nameValidation().test(
      'not-duplicate-portainer',
      () => !isDuplicatingPortainer
    ),
    alwaysPull: boolean().default(true),
    autoRemove: boolean().default(false),
    enableWebhook: boolean().default(false),
    nodeName: string().default(''),
    ports: portsSchema(),
    publishAllPorts: boolean().default(false),
    image: imageConfigValidation(),
  });
}
