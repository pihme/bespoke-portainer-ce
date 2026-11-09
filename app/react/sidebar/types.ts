import { EnvironmentType } from '@/react/portainer/environments/types';

type DockerStandalone = {
  provider: 'DOCKER_STANDALONE';
};

type KubeMode = {
  provider: 'KUBERNETES';
};

type AzureMode = {
  provider: 'AZURE';
};

type Mode = DockerStandalone | KubeMode | AzureMode;

type EnvironmentMode = { agentProxy: boolean } & Mode;

export interface EnvironmentState {
  name: string;
  mode: EnvironmentMode;
  apiVersion: number;
  type: EnvironmentType;
}
