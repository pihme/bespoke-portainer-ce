export interface AnalyticsState {
  podmanLocalEnvironment: number; // podman socket
  localEndpoint: number; // docker socket
}

export type AnalyticsStateKey = keyof AnalyticsState;
