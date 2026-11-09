import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';

import { PageHeader } from '@@/PageHeader';
import { Widget } from '@@/Widget';

import { CreateStackForm } from './CreateStackForm/CreateStackForm';

export function CreateView() {
  const environmentId = useEnvironmentId();

  return (
    <>
      <PageHeader title="Create stack" breadcrumbs="Stack creation" reload />

      <div className="row">
        <div className="col-sm-12">
          <Widget>
            <Widget.Body>
              <CreateStackForm environmentId={environmentId} />
            </Widget.Body>
          </Widget>
        </div>
      </div>
    </>
  );
}
