/** Docker Swarm is removed (TAI-003): a Docker engine is Standalone or Podman. */
export function getDockerEnvironmentType(isPodman?: boolean) {
  if (isPodman) {
    return 'Podman';
  }
  return 'Standalone';
}
