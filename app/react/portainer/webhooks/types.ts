import { EnvironmentId } from '../environments/types';

export enum WebhookType {
  DockerService = 1,
  DockerContainer = 2,
}

export interface Webhook {
  Id: number;
  Token: string;
  ResourceId: string;
  EndpointId: EnvironmentId;
  number: number;
  Type: WebhookType;
}

export interface Filters {
  endpointId: EnvironmentId;
  resourceId?: string;
}
