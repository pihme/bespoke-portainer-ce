import { object, string, number, boolean, array } from 'yup';

import { buildUniquenessTest } from '@@/form-components/validate-unique';

import { validationSchema as portsSchema } from './PortsMappingField.validation';

export function validationSchema() {
  return object().shape({
    name: string().required('Name is required.'),
    image: string().required('Image is required.'),
    subscription: string().required('Subscription is required.'),
    resourceGroup: string().required('Resource group is required.'),
    location: string().required('Location is required.'),
    os: string().oneOf(['Linux', 'Windows']),
    cpu: number().positive(),
    memory: number().positive(),
    allocatePublicIP: boolean(),
    ports: portsSchema(),
    env: array()
      .of(
        object().shape({
          name: string().required('Environment variable name is required.'),
          value: string().required('Environment variable value is required.'),
        })
      )
      .test(
        'unique',
        'This environment variable is already defined',
        buildUniquenessTest(
          () => 'This environment variable is already defined',
          'name'
        )
      ),
  });
}
