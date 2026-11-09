import Docker from '@/assets/ico/vendor/docker.svg?c';
import Podman from '@/assets/ico/vendor/podman.svg?c';
import Azure from '@/assets/ico/vendor/azure.svg?c';

import { BoxSelectorOption } from '@@/BoxSelector';

export type EnvironmentOptionValue =
  | 'dockerStandalone'
  | 'podman'
  | 'aci';

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
  {
    id: 'aci',
    value: 'aci',
    label: 'ACI',
    description: 'Connect to ACI environment via API',
    iconType: 'logo',
    icon: Azure,
  },
];

// KubeSolo (Edge) went with Kubernetes and Edge (TAI-002, TAI-004).
export const environmentTypes: EnvironmentOption[] = [
  ...existingEnvironmentTypes,
];

export const formTitles: Record<EnvironmentOptionValue, string> = {
  dockerStandalone: 'Connect to your Docker Standalone environment',
  podman: 'Connect to your Podman environment',
  aci: 'Connect to your ACI environment',
};
