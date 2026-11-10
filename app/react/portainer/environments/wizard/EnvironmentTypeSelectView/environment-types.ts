import Docker from '@/assets/ico/vendor/docker.svg?c';
import Podman from '@/assets/ico/vendor/podman.svg?c';

import { BoxSelectorOption } from '@@/BoxSelector';

export type EnvironmentOptionValue =
  | 'dockerStandalone'
  | 'podman';

export interface EnvironmentOption extends BoxSelectorOption<EnvironmentOptionValue> {
  id: EnvironmentOptionValue;
  value: EnvironmentOptionValue;
}
export const existingEnvironmentTypes: EnvironmentOption[] = [
  {
    id: 'dockerStandalone',
    value: 'dockerStandalone',
    label: 'Docker Standalone',
    icon: Docker,
    iconType: 'logo',
    description: 'Connect to Docker Standalone via URL/IP, API or Socket',
  },
  {
    id: 'podman',
    value: 'podman',
    label: 'Podman',
    icon: Podman,
    iconType: 'logo',
    description: 'Connect to Podman via URL/IP or Socket',
  },
];

// KubeSolo (Edge) went with Kubernetes and Edge (TAI-002, TAI-004); ACI
// went with Azure Container Instances (TAI-008).
export const environmentTypes: EnvironmentOption[] = [
  ...existingEnvironmentTypes,
];

export const formTitles: Record<EnvironmentOptionValue, string> = {
  dockerStandalone: 'Connect to your Docker Standalone environment',
  podman: 'Connect to your Podman environment',
};
