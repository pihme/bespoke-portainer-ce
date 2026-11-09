import { useState } from 'react';
import { Zap, Plug2 } from 'lucide-react';

import { Environment } from '@/react/portainer/environments/types';

import { BoxSelector, type BoxSelectorOption } from '@@/BoxSelector';
import { BadgeIcon } from '@@/BadgeIcon';
import { TextTip } from '@@/Tip/TextTip';
import { ExternalLink } from '@@/ExternalLink';
import { useDocsUrl } from '@@/PageHeader/ContextHelp';

import { AnalyticsStateKey } from '../types';

import { AgentTab } from './AgentTab';
import { SocketTab } from './SocketTab';

interface Props {
  onCreate(environment: Environment, analytics: AnalyticsStateKey): void;
}

type CreationType = 'agent' | 'socket';

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
    id: 'socket',
    icon: <BadgeIcon icon={Plug2} size="3xl" />,
    label: 'Socket',
    description: 'Connect to the environment directly via the Docker socket.',
    value: 'socket',
  },
];

export function WizardPodman({ onCreate }: Props) {
  const podmanSupportDocsUrl = useDocsUrl(
    '/faqs/installing/does-portainer-support-podman'
  );
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

      <TextTip color="orange" className="mb-2" inline={false}>
        Portainer connects to Podman through Podman&apos;s{' '}
        <b>Docker-compatible API</b> and only supports <b>Podman 5</b> running
        in rootful (privileged) mode on <b>CentOS 9</b> Linux environments.
        Rootless mode and other Linux distros may work, but aren&apos;t
        officially supported.{' '}
        <ExternalLink
          to={podmanSupportDocsUrl}
          data-cy="wizard-podman-support-docs-link"
        >
          Supported Podman configurations
        </ExternalLink>
      </TextTip>
      {tab}
    </div>
  );

  function getTab(creationType: CreationType) {
    switch (creationType) {
      case 'agent':
        return (
          <AgentTab
            onCreate={(environment) => onCreate(environment, 'podmanAgent')}
          />
        );
      case 'socket':
        return (
          <SocketTab
            onCreate={(environment) =>
              onCreate(environment, 'podmanLocalEnvironment')
            }
          />
        );
      default:
        return null;
    }
  }
}
