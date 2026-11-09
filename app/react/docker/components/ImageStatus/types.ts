type Status = 'outdated' | 'updated' | 'inprocess' | string;

export enum ResourceType {
  CONTAINER,
}

export interface ImageStatus {
  Status: Status;
  Message: string;
}

export type ResourceID = string;
