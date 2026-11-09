import { useCurrentStateAndParams, useRouter } from '@uirouter/react';

import { notifySuccess } from '@/portainer/services/notifications';

import { Environment } from '../types';
import { isAzureEnvironment } from '../utils';

import { AzureEnvironmentForm } from './AzureEnvironmentForm/AzureEnvironmentForm';
import { GeneralEnvironmentForm } from './GeneralEnvironmentForm/GeneralEnvironmentForm';

export function EnvironmentDetailsForm({
  environment,
}: {
  environment: Environment;
}) {
  const router = useRouter();
  const {
    params: { redirectTo = '' },
  } = useCurrentStateAndParams();
  const isAzure = isAzureEnvironment(environment.Type);

  if (isAzure) {
    return (
      <AzureEnvironmentForm
        environment={environment}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <GeneralEnvironmentForm
      environment={environment}
      onSuccess={handleSuccess}
    />
  );

  function handleSuccess() {
    notifySuccess('Environment updated', environment.Name);
    router.stateService.go(
      redirectTo || 'portainer.endpoints',
      {},
      { reload: true }
    );
  }
}
