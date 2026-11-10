import {
  Box,
  Clock,
  Layers,
  List,
  Trello,
  Edit,
  Network,
  Database,
} from 'lucide-react';

import {
  type Environment,
  type EnvironmentId,
} from '@/react/portainer/environments/types';
import { Authorized, useIsEnvironmentAdmin } from '@/react/hooks/useUser';

import { SidebarItem } from './SidebarItem';
import { DashboardLink } from './items/DashboardLink';
import { SidebarParent } from './SidebarItem/SidebarParent';

interface Props {
  environmentId: EnvironmentId;
  environment: Environment;
}

export function DockerSidebar({ environmentId, environment }: Props) {
  const { authorized: isEnvironmentAdmin } = useIsEnvironmentAdmin({
    adminOnlyCE: true,
  });

  const areStacksVisible =
    isEnvironmentAdmin ||
    environment.SecuritySettings.allowStackManagementForRegularUsers;

  // Docker Swarm is removed (TAI-003): every Docker engine shows the Host
  // area and no Swarm services, configs or secrets.
  const setupSubMenuProps = {
    label: 'Host',
    icon: Trello,
    to: 'docker.host',
    dataCy: 'portainerSidebar-host',
  };

  const featSubMenuTo = 'docker.host.featuresConfiguration';

  return (
    <>
      <DashboardLink
        environmentId={environmentId}
        platformPath="docker"
        data-cy="dockerSidebar-dashboard"
      />
      <SidebarParent
        icon={Edit}
        label="Templates"
        to="docker.templates"
        params={{ endpointId: environmentId }}
        data-cy="portainerSidebar-templates"
        listId="dockerSidebar-templates"
      >
        <SidebarItem
          label="Application"
          to="docker.templates"
          ignorePaths={['docker.templates.custom']}
          params={{ endpointId: environmentId }}
          isSubMenu
          data-cy="portainerSidebar-appTemplates"
        />
        <SidebarItem
          label="Custom"
          to="docker.templates.custom"
          params={{ endpointId: environmentId }}
          isSubMenu
          data-cy="dockerSidebar-customTemplates"
        />
      </SidebarParent>

      {areStacksVisible && (
        <SidebarItem
          to="docker.stacks"
          params={{ endpointId: environmentId }}
          icon={Layers}
          label="Stacks"
          data-cy="dockerSidebar-stacks"
        />
      )}


      <SidebarItem
        to="docker.containers"
        params={{ endpointId: environmentId }}
        icon={Box}
        label="Containers"
        data-cy="dockerSidebar-containers"
      />

      <SidebarItem
        to="docker.images"
        params={{ endpointId: environmentId }}
        icon={List}
        label="Images"
        data-cy="dockerSidebar-images"
      />

      <SidebarItem
        to="docker.networks"
        params={{ endpointId: environmentId }}
        icon={Network}
        label="Networks"
        data-cy="dockerSidebar-networks"
      />

      <SidebarItem
        to="docker.volumes"
        params={{ endpointId: environmentId }}
        icon={Database}
        label="Volumes"
        data-cy="dockerSidebar-volumes"
      />



      {isEnvironmentAdmin && (
        <SidebarItem
          to="docker.events"
          params={{ endpointId: environmentId }}
          icon={Clock}
          label="Events"
          data-cy="dockerSidebar-events"
        />
      )}

      <SidebarParent
        label={setupSubMenuProps.label}
        icon={setupSubMenuProps.icon}
        to={setupSubMenuProps.to}
        params={{ endpointId: environmentId }}
        data-cy="portainerSidebar-host-area"
        listId="portainerSidebar-host-area"
      >
        <SidebarItem
          label="Details"
          isSubMenu
          to={setupSubMenuProps.to}
          params={{ endpointId: environmentId }}
          ignorePaths={[featSubMenuTo]}
          data-cy={setupSubMenuProps.dataCy}
        />

        <Authorized
          authorizations="PortainerEndpointUpdateSettings"
          adminOnlyCE
          environmentId={environmentId}
        >
          <SidebarItem
            label="Setup"
            isSubMenu
            to={featSubMenuTo}
            params={{ endpointId: environmentId }}
            data-cy="portainerSidebar-docker-setup"
          />
        </Authorized>
      </SidebarParent>
    </>
  );
}
