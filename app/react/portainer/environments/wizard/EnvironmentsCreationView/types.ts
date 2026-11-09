export interface AnalyticsState {
  dockerAgent: number;
  dockerApi: number;
  podmanAgent: number;
  podmanLocalEnvironment: number; // podman socket
  aciApi: number;
  localEndpoint: number; // docker socket
}

export type AnalyticsStateKey = keyof AnalyticsState;
