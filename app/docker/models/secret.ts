import { Secret } from 'docker-types';

import { ResourceControlViewModel } from '@/react/portainer/access-control/models/ResourceControlViewModel';
import { PortainerResponse } from '@/react/docker/types';

export class SecretViewModel {
  Id: string;

  CreatedAt: string;

  UpdatedAt: string;

  Version: number;

  Name: string;

  Labels: Record<string, string>;

  ResourceControl?: ResourceControlViewModel;

  constructor(data: PortainerResponse<Secret>) {
    this.Id = data.ID || '';
    this.CreatedAt = data.CreatedAt || '';
    this.UpdatedAt = data.UpdatedAt || '';
    this.Version = data.Version?.Index || 0;
    this.Name = data.Spec?.Name || '';
    this.Labels = data.Spec?.Labels || {};

    if (data.Portainer?.ResourceControl) {
      this.ResourceControl = new ResourceControlViewModel(
        data.Portainer.ResourceControl
      );
    }
  }
}
