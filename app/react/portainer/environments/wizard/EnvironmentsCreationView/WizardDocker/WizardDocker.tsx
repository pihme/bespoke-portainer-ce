import { Plug2 } from 'lucide-react';

import { Environment } from '@/react/portainer/environments/types';

import { BoxSelector, type BoxSelectorOption } from '@@/BoxSelector';
import { BadgeIcon } from '@@/BadgeIcon';

import { AnalyticsStateKey } from '../types';

import { SocketTab } from './SocketTab';

interface Props {
  onCreate(environment: Environment, analytics: AnalyticsStateKey): void;
}

// Portainer Agent and remote Docker API environments are removed (TAI-007):
// a Docker environment is only connected through the local socket.
type CreationType = 'socket';

const options: BoxSelectorOption<CreationType>[] = [
  {
    id: 'socket',
    icon: <BadgeIcon icon={Plug2} size="3xl" />,
    label: 'Socket',
    description: 'Connect to the environment directly via the Docker socket.',
    value: 'socket',
  },
];

export function WizardDocker({ onCreate }: Props) {
  return (
    <div className="form-horizontal">
      <BoxSelector
        onChange={() => {}}
        options={options}
        value="socket"
        radioName="creation-type"
        className="mb-8"
      />

      <SocketTab
        onCreate={(environment) => onCreate(environment, 'localEndpoint')}
      />
    </div>
  );
}
