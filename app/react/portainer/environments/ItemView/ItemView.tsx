import { useIdParam } from '@/react/hooks/useIdParam';

import { PageHeader } from '@@/PageHeader';
import { TextTip } from '@@/Tip/TextTip';

import { useEnvironment } from '../queries';
import { isEdgeEnvironment } from '../utils';

import { EnvironmentDetailsForm } from './EnvironmentDetailsForm';

export function ItemView() {
  const id = useIdParam();
  const environmentQuery = useEnvironment(id);

  if (!environmentQuery.data) {
    return null;
  }

  const environment = environmentQuery.data;

  const isEdge = isEdgeEnvironment(environment.Type);

  return (
    <>
      <PageHeader
        title="Environment details"
        breadcrumbs={[
          { label: 'Environments', link: 'portainer.endpoints' },
          environment.Name,
        ]}
        reload
      />

      <div className="mx-4 space-y-4 [&>*]:block">
        {isEdge ? (
          <TextTip color="orange">
            Edge environments are no longer supported. This environment can
            only be removed from the environments list.
          </TextTip>
        ) : (
          <EnvironmentDetailsForm environment={environment} />
        )}
      </div>
    </>
  );
}
