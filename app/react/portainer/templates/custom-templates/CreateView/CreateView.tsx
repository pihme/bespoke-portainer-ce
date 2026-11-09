import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { StackType } from '@/react/common/stacks/types';

import { PageHeader } from '@@/PageHeader';
import { Widget } from '@@/Widget';

import { useViewType } from '../useViewType';

import { CreateForm } from './CreateForm';

export function CreateView() {
  const viewType = useViewType();
  const environmentId = useEnvironmentId(false);
  // Docker Swarm is removed (TAI-003): new templates default to Compose.
  const defaultType = StackType.DockerCompose;

  return (
    <div>
      <PageHeader
        title="Create Custom Template"
        breadcrumbs={[
          { label: 'Custom Templates', link: '^' },
          'Create Custom Template',
        ]}
      />

      <div className="row">
        <div className="col-sm-12">
          <Widget>
            <Widget.Body>
              <CreateForm
                viewType={viewType}
                environmentId={environmentId}
                defaultType={defaultType}
              />
            </Widget.Body>
          </Widget>
        </div>
      </div>
    </div>
  );
}
