// Resource ownership (UI and API) is removed (TAI-001). These types only
// describe the ResourceControl field the backend still attaches to resources.
import { UserId } from '@/portainer/users/types/user-id';

type TeamId = number;

export type ResourceControlId = number;

export type ResourceId = number | string;

export enum ResourceControlOwnership {
  PUBLIC = 'public',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
  ADMINISTRATORS = 'administrators',
}

export enum ResourceControlType {
  // Container represents a resource control associated to a Docker container
  Container = 1,
  // Service represents a resource control associated to a Docker service
  Service,
  // Volume represents a resource control associated to a Docker volume
  Volume,
  // Network represents a resource control associated to a Docker network
  Network,
  // Secret represents a resource control associated to a Docker secret
  Secret,
  // Stack represents a resource control associated to a stack composed of Docker services
  Stack,
  // Config represents a resource control associated to a Docker config
  Config,
  // CustomTemplate represents a resource control associated to a custom template
  CustomTemplate,
  // ContainerGroup represents a resource control associated to an Azure container group
  ContainerGroup,
}

export enum ResourceAccessLevel {
  ReadWriteAccessLevel = 1,
}

export interface UserResourceAccess {
  UserId: UserId;
  AccessLevel: ResourceAccessLevel;
}

export interface TeamResourceAccess {
  TeamId: TeamId;
  AccessLevel: ResourceAccessLevel;
}

export interface ResourceControlResponse {
  Id: number;
  Type: ResourceControlType;
  ResourceId: ResourceId;
  UserAccesses: UserResourceAccess[];
  TeamAccesses: TeamResourceAccess[];
  Public: boolean;
  AdministratorsOnly: boolean;
  System: boolean;
}
