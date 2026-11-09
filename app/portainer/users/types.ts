import { EnvironmentId } from '@/react/portainer/environments/types';

import { type UserId } from './types/user-id';

export { type UserId };

export interface AuthorizationMap {
  [authorization: string]: boolean;
}

export enum Role {
  Admin = 1,
  Standard,
  EdgeAdmin,
}

export const RoleNames: { [key in Role]: string } = {
  [Role.Admin]: 'administrator',
  [Role.Standard]: 'user',
  [Role.EdgeAdmin]: 'edge administrator',
};

export type ThemeColor = 'dark' | 'light' | 'highcontrast' | 'auto';

export type User = {
  Id: UserId;
  Username: string;
  Role: Role;
  EndpointAuthorizations: {
    [endpointId: EnvironmentId]: AuthorizationMap;
  };
  UseCache: boolean;
  ThemeSettings: {
    color: ThemeColor;
  };
};
