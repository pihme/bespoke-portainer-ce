import { useState } from 'react';
import { Zap, Network, Plug2 } from 'lucide-react';

import { Environment } from '@/react/portainer/environments/types';

import { BoxSelector, type BoxSelectorOption } from '@@/BoxSelector';
import { BadgeIcon } from '@@/BadgeIcon';

import { AnalyticsStateKey } from '../types';

import { AgentTab } from './AgentTab';
import { APITab } from './APITab';
import { SocketTab } from './SocketTab';

interface Props {
  onCreate(environment: Environment, analytics: AnalyticsStateKey): void;
}

type CreationType = 'agent' | 'api' | 'socket';

const options: BoxSelectorOption<CreationType>[] = [
  {
    id: 'agent',
    icon: <BadgeIcon icon={Zap} size="3xl" />,
    label: 'Agent',
    description:
      'The Portainer Server will initiate connections to the remote environment. The agent on the remote environment must be accessible from the Portainer server environment.',
    value: 'agent',
  },
  {
    id: 'api',
    icon: <BadgeIcon icon={Network} size="3xl" />,
    label: 'API',
    description: 'Connect to the environment directly via the Docker API.',
    value: 'api',
  },
  {
    id: 'socket',
    icon: <BadgeIcon icon={Plug2} size="3xl" />,
    label: 'Socket',
    description: 'Connect to the environment directly via the Docker socket.',
    value: 'socket',
  },
];

export function WizardDocker({ onCreate }: Props) {
  const [creationType, setCreationType] = useState<CreationType>('socket');

  const tab = getTab(creationType);

  return (
    <div className="form-horizontal">
      <BoxSelector
        onChange={(v) => setCreationType(v)}
        options={options}
        value={creationType}
        radioName="creation-type"
        className="mb-8"
      />

      {tab}
    </div>
  );

  function getTab(creationType: CreationType) {
    switch (creationType) {
      case 'agent':
        return (
          <AgentTab
            onCreate={(environment) => onCreate(environment, 'dockerAgent')}
          />
        );
      case 'api':
        return (
          <APITab
            onCreate={(environment) => onCreate(environment, 'dockerApi')}
          />
        );
      case 'socket':
        return (
          <SocketTab
            onCreate={(environment) => onCreate(environment, 'localEndpoint')}
          />
        );
      default:
        return null;
    }
  }
}
