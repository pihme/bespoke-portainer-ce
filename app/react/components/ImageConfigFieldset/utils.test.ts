import { RegistryTypes } from '@/react/portainer/registries/types/registry';

import { getIsDockerHubRegistry } from './utils';

describe('getIsDockerHubRegistry', () => {
  it('treats missing, DockerHub and anonymous registries as Docker Hub', () => {
    expect(getIsDockerHubRegistry(undefined)).toBe(true);
    expect(getIsDockerHubRegistry(null)).toBe(true);
    expect(
      getIsDockerHubRegistry({ Type: RegistryTypes.DOCKERHUB } as never)
    ).toBe(true);
    expect(
      getIsDockerHubRegistry({ Type: RegistryTypes.ANONYMOUS } as never)
    ).toBe(true);
    expect(
      getIsDockerHubRegistry({ Type: RegistryTypes.CUSTOM } as never)
    ).toBe(false);
  });
});
