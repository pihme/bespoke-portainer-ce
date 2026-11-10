import { ImageConfigValues } from '@@/ImageConfigFieldset';

export function getDefaultImageConfig(): ImageConfigValues {
  return {
    image: '',
  };
}

/**
 * Registries are gone (TAI-005): the image is always the full name as typed.
 */
export function getImageConfig(repository: string): ImageConfigValues {
  return {
    image: repository,
  };
}
