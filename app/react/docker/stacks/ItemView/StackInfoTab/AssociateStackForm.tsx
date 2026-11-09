import { RefreshCw } from 'lucide-react';
import { Form, Formik, useFormikContext } from 'formik';
import { useRouter } from '@uirouter/react';

import { EnvironmentId } from '@/react/portainer/environments/types';
import { useSwarmId } from '@/react/docker/proxy/queries/useSwarm';
import { notifySuccess } from '@/portainer/services/notifications';

import { LoadingButton } from '@@/buttons';
import { FormSection } from '@@/form-components/FormSection';

import { useAssociateStackToEnvironmentMutation } from './useAssociateStackToEnvironmentMutation';

export function AssociateStackForm({
  stackName,
  environmentId,
  stackId,
  isOrphanedRunning,
}: {
  stackName: string;
  environmentId: EnvironmentId;
  stackId: number;
  isOrphanedRunning: boolean | undefined;
}) {
  const router = useRouter();
  const swarmIdQuery = useSwarmId(environmentId);
  const mutation = useAssociateStackToEnvironmentMutation();


  return (
    <FormSection title="Associate to this environment">
      <p className="small text-muted">
        This feature allows you to re-associate this stack to the current
        environment.
      </p>

      <Formik
        initialValues={{}}
        onSubmit={() => {
          mutation.mutate(
            {
              environmentId,
              swarmId: swarmIdQuery.data,
              isOrphanedRunning,
              stackId,
            },
            {
              onSuccess() {
                notifySuccess('Stack successfully associated', stackName);
                router.stateService.go('docker.stacks');
              },
            }
          );
        }}
      >
        <InnerForm />
      </Formik>
    </FormSection>
  );
}
function InnerForm() {
  const { isSubmitting } = useFormikContext();

  return (
    <Form className="form-horizontal">
      <div className="form-group">
        <div className="col-sm-12">
          <LoadingButton
            color="primary"
            size="small"
            isLoading={isSubmitting}
            loadingText="Association in progress..."
            icon={RefreshCw}
            className="-ml-1.25"
            data-cy="stack-associate-btn"
          >
            Associate
          </LoadingButton>
        </div>
      </div>
    </Form>
  );
}
