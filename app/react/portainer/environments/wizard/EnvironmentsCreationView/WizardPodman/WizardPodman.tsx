import { Plug2 } from 'lucide-react';

import { Environment } from '@/react/portainer/environments/types';

import { BoxSelector, type BoxSelectorOption } from '@@/BoxSelector';
import { BadgeIcon } from '@@/BadgeIcon';
import { TextTip } from '@@/Tip/TextTip';
import { ExternalLink } from '@@/ExternalLink';
import { useDocsUrl } from '@@/PageHeader/ContextHelp';

import { AnalyticsStateKey } from '../types';

import { SocketTab } from './SocketTab';

interface Props {
  onCreate(environment: Environment, analytics: AnalyticsStateKey): void;
}

// Portainer Agent environments are removed (TAI-007): a Podman environment is
// only connected through the local socket.
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

export function WizardPodman({ onCreate }: Props) {
  const podmanSupportDocsUrl = useDocsUrl(
    '/faqs/installing/does-portainer-support-podman'
  );
  return (
    <div className="form-horizontal">
      <BoxSelector
        onChange={() => {}}
        options={options}
        value="socket"
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
      <SocketTab
        onCreate={(environment) =>
          onCreate(environment, 'podmanLocalEnvironment')
        }
      />
    </div>
  );
}
