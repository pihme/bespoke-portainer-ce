import { FormikErrors } from 'formik';
import { PropsWithChildren } from 'react';

import { FormControl } from '@@/form-components/FormControl';
import { Input } from '@@/form-components/Input';
import { TextTip } from '@@/Tip/TextTip';

import { Values } from './types';

/**
 * The image name field. Registries are gone (TAI-005): there is no registry
 * picker, no simple/advanced mode and no Docker Hub rate limit check; the image
 * is pulled by its full name.
 */
export function ImageConfigFieldset({
  children,
  values,
  errors,
  onChangeImage,
  setFieldValue,
}: PropsWithChildren<{
  values: Values;
  errors?: FormikErrors<Values>;
  onChangeImage?: (name: string) => void;
  setFieldValue: <T>(field: string, value: T) => void;
}>) {
  return (
    <div className="row">
      <TextTip color="blue">
        The image is pulled by its full name; private registries need the
        credentials of the Docker engine.
      </TextTip>
      <FormControl label="Image" inputId="image-field" errors={errors?.image}>
        <Input
          id="image-field"
          value={values.image}
          onChange={(e) => {
            const { value } = e.target;
            setFieldValue('image', value);
            setTimeout(() => onChangeImage?.(value), 0);
          }}
          placeholder="e.g. registry:port/my-image:my-tag"
          required
          data-cy="image-config-advanced-input"
        />
      </FormControl>

      {children}
    </div>
  );
}
