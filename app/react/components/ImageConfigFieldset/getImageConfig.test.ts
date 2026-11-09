import { RegistryTypes } from '@/react/portainer/registries/types/registry';
import type { Registry } from '@/react/portainer/registries/types/registry';

import { getDefaultImageConfig, getImageConfig } from './getImageConfig';

vi.mock('@/react/docker/images/utils', () => ({
  imageContainsURL: (image: string) => image.includes('/'),
}));

vi.mock('@/react/portainer/registries/utils/getUrl', () => ({
  getURL: (registry: Registry) => registry.URL,
}));

function registry(
  overrides: Partial<Registry> & Pick<Registry, 'Id' | 'URL' | 'Type'>
): Registry {
  return {
    Name: 'r',
    Username: '',
    Authentication: false,
    BaseURL: '',
    Ecr: { Region: '' },
    Github: { OrganisationName: '', UseOrganisation: false },
    Quay: { OrganisationName: '', UseOrganisation: false },
    Gitlab: { InstanceURL: '', ProjectId: 0, ProjectPath: '' },
    RegistryAccesses: {},
    ...overrides,
  };
}

describe('REQ-IMG-02 getImageConfig', () => {
  it('returns the default simple-mode blank config', () => {
    expect(getDefaultImageConfig()).toEqual({
      registryId: 0,
      image: '',
      useRegistry: true,
    });
  });

  it('strips a matching registry URL prefix including a leading slash', () => {
    const registries = [
      registry({
        Id: 2,
        Type: RegistryTypes.CUSTOM,
        URL: 'registry.example.com',
      }),
    ];
    expect(
      getImageConfig('registry.example.com/library/nginx:latest', registries, 2)
    ).toEqual({
      useRegistry: true,
      image: 'library/nginx:latest',
      registryId: 2,
    });
  });

  it('falls back to free-form image when no registry matches', () => {
    expect(getImageConfig('nginx:latest', [])).toEqual({
      image: 'nginx:latest',
      useRegistry: false,
    });
    expect(getImageConfig('ghcr.io/org/app:1', [])).toEqual({
      image: 'ghcr.io/org/app:1',
      useRegistry: true,
    });
  });
});
