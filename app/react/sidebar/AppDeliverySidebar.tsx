import { Database } from 'lucide-react';

import { SidebarItem } from './SidebarItem';
import { SidebarSection } from './SidebarSection';

export function AppDeliverySidebar() {
  return (
    <SidebarSection title="App Delivery">
      {/* The GitOps workflows view is removed (TAI-011). */}
      <SidebarItem
        label="Sources"
        to="portainer.gitops.sources"
        icon={Database}
        data-cy="portainerSidebar-sources"
      />
    </SidebarSection>
  );
}
