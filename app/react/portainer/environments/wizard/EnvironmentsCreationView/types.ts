export interface AnalyticsState {
  podmanLocalEnvironment: number; // podman socket
  aciApi: number;
  localEndpoint: number; // docker socket
}

export type AnalyticsStateKey = keyof AnalyticsState;
