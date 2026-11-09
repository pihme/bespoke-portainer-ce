import { PageHeader } from '@@/PageHeader';

import { PullImageFormWidget } from './PullImageFormWidget';
import { ImagesDatatable } from './ImagesDatatable/ImagesDatatable';

// Docker Swarm is removed (TAI-003): images are never listed or pulled per
// Swarm node, so the node selector and host column stay hidden.
export function ListView() {
  return (
    <>
      <PageHeader title="Image list" breadcrumbs="Images" reload />

      <div className="row">
        <div className="col-sm-12">
          <PullImageFormWidget isNodeVisible={false} />
        </div>
      </div>

      <ImagesDatatable isHostColumnVisible={false} />
    </>
  );
}
