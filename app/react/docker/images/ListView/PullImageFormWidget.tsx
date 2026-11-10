import { DownloadIcon } from 'lucide-react';
import { Formik } from 'formik';

import { useAuthorizations } from '@/react/hooks/useUser';
import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { notifySuccess } from '@/portainer/services/notifications';

import { getDefaultImageConfig } from '@@/ImageConfigFieldset/getImageConfig';
import { Widget } from '@@/Widget';

import { usePullImageMutation } from '../queries/usePullImageMutation';

import { FormValues } from './PullImageFormWidget.types';
import { PullImageForm } from './PullImageFormWidget.Form';
import { useValidation } from './PullImageFormWidget.validation';

export function PullImageFormWidget() {
  const envId = useEnvironmentId();
  const mutation = usePullImageMutation(envId);
  const authorizedQuery = useAuthorizations('DockerImageCreate');
  const validation = useValidation();

  if (!authorizedQuery.authorized) {
    return null;
  }

  const initialValues: FormValues = {
    config: getDefaultImageConfig(),
  };

  return (
    <Widget>
      <Widget.Title icon={DownloadIcon} title="Pull image" />
      <Widget.Body>
        <Formik
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validationSchema={validation}
          validateOnMount
        >
          <PullImageForm isLoading={mutation.isLoading} />
        </Formik>
      </Widget.Body>
    </Widget>
  );

  function handleSubmit({ config }: FormValues) {
    mutation.mutate(
      {
        environmentId: envId,
        image: config.image,
        ignoreErrors: false,
      },
      {
        onSuccess() {
          notifySuccess('Image successfully pulled', config.image);
        },
      }
    );
  }
}
