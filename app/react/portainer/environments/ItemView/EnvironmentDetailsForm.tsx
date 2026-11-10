import { useCurrentStateAndParams, useRouter } from '@uirouter/react';

import { notifySuccess } from '@/portainer/services/notifications';

import { Environment } from '../types';

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
  // Azure Container Instances are removed (TAI-008): a leftover Azure
  // environment is edited with the general form (name, group, tags).
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
