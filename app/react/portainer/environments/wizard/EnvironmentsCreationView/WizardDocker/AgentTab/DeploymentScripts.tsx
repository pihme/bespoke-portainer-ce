import { useState } from 'react';

import { useAgentDetails } from '@/react/portainer/environments/queries/useAgentDetails';

import { CopyButton } from '@@/buttons/CopyButton';
import { Code } from '@@/Code';
import { NavTabs } from '@@/NavTabs';
import { NavContainer } from '@@/NavTabs/NavContainer';

const deploymentsStandalone = [
  {
    id: 'linux',
    label: 'Linux & Windows WSL',
    command: linuxStandaloneCommand,
  },
  {
    id: 'win',
    label: 'Windows WCS',
    command: winStandaloneCommand,
  },
];

export function DeploymentScripts() {
  const deployments = deploymentsStandalone;
  const [deployType, setDeployType] = useState(deployments[0].id);

  const agentDetailsQuery = useAgentDetails();

  if (!agentDetailsQuery) {
    return null;
  }

  const { agentVersion, agentSecret } = agentDetailsQuery;

  const options = deployments.map((c) => {
    const code = c.command(agentVersion, agentSecret);

    return {
      id: c.id,
      label: c.label,
      children: <DeployCode code={code} />,
    };
  });

  return (
    <NavContainer>
      <NavTabs
        options={options}
        onSelect={(id: string) => setDeployType(id)}
        selectedId={deployType}
      />
    </NavContainer>
  );
}

interface DeployCodeProps {
  code: string;
}

function DeployCode({ code }: DeployCodeProps) {
  return (
    <>
      <div className="code-script">
        <Code>{code}</Code>
      </div>
      <div className="mt-2">
        <CopyButton copyText={code} data-cy="copy-deployment-script">
          Copy command
        </CopyButton>
      </div>
    </>
  );
}

function linuxStandaloneCommand(agentVersion: string, agentSecret: string) {
  const secret =
    agentSecret === '' ? '' : `\\\n  -e AGENT_SECRET=${agentSecret} `;

  return `docker run -d \\
  -p 9001:9001 ${secret}\\
  --name portainer_agent \\
  --restart=always \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -v /var/lib/docker/volumes:/var/lib/docker/volumes \\
  -v /:/host \\
  portainer/agent:${agentVersion}
`;
}

function winStandaloneCommand(agentVersion: string, agentSecret: string) {
  const secret =
    agentSecret === '' ? '' : `\`\n  -e AGENT_SECRET=${agentSecret} `;

  return `docker run -d \`
  -p 9001:9001 ${secret}\`
  --name portainer_agent \`
  --restart=always \`
  -v C:\\:C:\\host \`
  -v C:\\ProgramData\\docker\\volumes:C:\\ProgramData\\docker\\volumes \`
  -v \\\\.\\pipe\\docker_engine:\\\\.\\pipe\\docker_engine \`
  portainer/agent:${agentVersion}
`;
}

