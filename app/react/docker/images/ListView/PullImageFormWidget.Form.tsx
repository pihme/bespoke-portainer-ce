import { Form, useFormikContext } from 'formik';

import { ImageConfigFieldset } from '@@/ImageConfigFieldset';
import { FormActions } from '@@/form-components/FormActions';

import { FormValues } from './PullImageFormWidget.types';

export function PullImageForm({ isLoading }: { isLoading: boolean }) {
  const { values, setFieldValue, errors, isValid } =
    useFormikContext<FormValues>();

  return (
    <Form className="form-horizontal">
      <ImageConfigFieldset
        values={values.config}
        setFieldValue={(field, value) =>
          setFieldValue(`config.${field}`, value)
        }
        errors={errors.config}
      >
        <FormActions
          isLoading={isLoading}
          isValid={isValid}
          loadingText="Download in progress..."
          submitLabel="Pull the image"
          data-cy="pull-image-button"
        />
      </ImageConfigFieldset>
    </Form>
  );
}
