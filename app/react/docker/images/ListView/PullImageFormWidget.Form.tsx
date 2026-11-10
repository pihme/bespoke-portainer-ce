import { Form, useFormikContext } from 'formik';

import { ImageConfigFieldset } from '@@/ImageConfigFieldset';
import { FormSection } from '@@/form-components/FormSection';
import { FormActions } from '@@/form-components/FormActions';

import { NodeSelector } from '../../agent/NodeSelector';

import { FormValues } from './PullImageFormWidget.types';

export function PullImageForm({
  isLoading,
  isNodeVisible,
}: {
  isLoading: boolean;
  isNodeVisible: boolean;
}) {
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
        {isNodeVisible && (
          <FormSection title="Deployment">
            <NodeSelector
              value={values.node}
              onChange={(node) => setFieldValue('node', node)}
              error={errors.node}
            />
          </FormSection>
        )}

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
