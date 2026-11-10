import { object, SchemaOf, string } from 'yup';

import { Values } from './types';

export function validation(): SchemaOf<Values> {
  return object({
    image: string().required('Image is required'),
  });
}
