import {
  Award,
  Settings,
  HardDrive,
  Bell,
} from 'lucide-react';

import { isBE } from '@/react/portainer/feature-flags/feature-flags.service';

import { SidebarItem } from './SidebarItem';
import { SidebarSection } from './SidebarSection';
import { SidebarParent } from './SidebarItem/SidebarParent';

interface Props {
  isPureAdmin: boolean;
  isAdmin: boolean;
}

export function SettingsSidebar({ isPureAdmin, isAdmin }: Props) {
  return (
    <SidebarSection title="Administration">
      {isPureAdmin && (
        <>
          {/* Environment groups and tags are removed (TAI-013): Environments
              is a single item instead of an "Environment-related" menu. */}
          <SidebarItem
            label="Environments"
            icon={HardDrive}
            to="portainer.endpoints"
            includePaths={['portainer.wizard.endpoints']}
            data-cy="portainerSidebar-environments"
          />

          {isBE && (
            <SidebarItem
              to="portainer.licenses"
              label="Licenses"
              icon={Award}
              data-cy="portainerSidebar-licenses"
            />
          )}
        </>
      )}

      <SidebarItem
        to="portainer.notifications"
        icon={Bell}
        label="Notifications"
        data-cy="portainerSidebar-notifications"
      />
      {isPureAdmin && (
        <SidebarParent
          to="portainer.settings"
          label="Settings"
          icon={Settings}
          data-cy="portainerSidebar-settings"
          listId="portainer-settings"
        >
          <SidebarItem
            to="portainer.settings"
            label="General"
            isSubMenu
            ignorePaths={['portainer.settings.sharedcredentials']}
            data-cy="portainerSidebar-generalSettings"
          />
          {isBE && (
            <SidebarItem
              to="portainer.settings.sharedcredentials"
              label="Shared Credentials"
              isSubMenu
              data-cy="portainerSidebar-cloud"
            />
          )}
        </SidebarParent>
      )}
    </SidebarSection>
  );
}
