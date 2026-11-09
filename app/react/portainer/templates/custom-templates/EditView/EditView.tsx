import { useCurrentStateAndParams } from '@uirouter/react';

import { PageHeader } from '@@/PageHeader';
import { Widget } from '@@/Widget';

import { useCustomTemplate } from '../queries/useCustomTemplate';
import { useViewType } from '../useViewType';

import { EditForm } from './EditForm';

export function EditView() {
  const viewType = useViewType();
  const {
    params: { id },
  } = useCurrentStateAndParams();
  const templateQuery = useCustomTemplate(id);

  if (!templateQuery.data) {
    return null;
  }

  const template = templateQuery.data;

  return (
    <div>
      <PageHeader
        title="Edit Custom template"
        breadcrumbs={[{ label: 'Custom Templates', link: '^' }, template.Title]}
      />

      <div className="row">
        <div className="col-sm-12">
          <Widget>
            <Widget.Body>
              <EditForm
                template={template}
                viewType={viewType}
              />
            </Widget.Body>
          </Widget>
        </div>
      </div>
    </div>
  );
}
