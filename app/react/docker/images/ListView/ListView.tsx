import { PageHeader } from '@@/PageHeader';

import { PullImageFormWidget } from './PullImageFormWidget';
import { ImagesDatatable } from './ImagesDatatable/ImagesDatatable';

// Docker Swarm (TAI-003) and the Portainer Agent with per-node targeting
// (TAI-007) are removed: images are never listed or pulled per node.
export function ListView() {
  return (
    <>
      <PageHeader title="Image list" breadcrumbs="Images" reload />

      <div className="row">
        <div className="col-sm-12">
          <PullImageFormWidget />
        </div>
      </div>

      <ImagesDatatable />
    </>
  );
}
