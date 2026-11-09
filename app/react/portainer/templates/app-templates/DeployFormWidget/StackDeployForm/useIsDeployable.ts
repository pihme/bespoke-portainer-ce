import { TemplateType } from '@/react/portainer/templates/app-templates/types';

/**
 * Docker Swarm is removed (TAI-003): Swarm stack templates cannot be deployed.
 */
export function useIsDeployable(type: TemplateType) {
  switch (type) {
    case TemplateType.ComposeStack:
    case TemplateType.Container:
      return true;
    default:
      return false;
  }
}
