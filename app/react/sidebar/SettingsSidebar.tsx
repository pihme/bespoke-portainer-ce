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
          <SidebarParent
            label="Environment-related"
            icon={HardDrive}
            to="portainer.endpoints"
            pathOptions={{
              includePaths: [
                'portainer.wizard.endpoints',
                'portainer.groups',
                'portainer.tags',
              ],
            }}
            data-cy="portainerSidebar-environments-area"
            listId="portainer-environments"
          >
            <SidebarItem
              label="Environments"
              to="portainer.endpoints"
              includePaths={['portainer.wizard.endpoints']}
              isSubMenu
              data-cy="portainerSidebar-environments"
            />
            <SidebarItem
              to="portainer.groups"
              label="Groups"
              isSubMenu
              data-cy="portainerSidebar-environmentGroups"
            />
            <SidebarItem
              to="portainer.tags"
              label="Tags"
              isSubMenu
              data-cy="portainerSidebar-environmentTags"
            />
          </SidebarParent>

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
