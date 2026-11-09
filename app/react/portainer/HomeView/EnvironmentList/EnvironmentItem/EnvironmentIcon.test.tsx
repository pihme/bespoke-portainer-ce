import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ContainerEngine,
  EnvironmentType,
} from '@/react/portainer/environments/types';

import { EnvironmentIcon } from './EnvironmentIcon';

describe('REQ-ENV-01 EnvironmentIcon local Docker', () => {
  it('renders the Docker icon for a local Docker environment', () => {
    render(<EnvironmentIcon type={EnvironmentType.Docker} />);
    expect(screen.getByAltText('docker environment')).toBeVisible();
  });

  it('renders the Podman icon when the container engine is Podman', () => {
    render(
      <EnvironmentIcon
        type={EnvironmentType.Docker}
        containerEngine={ContainerEngine.Podman}
      />
    );
    expect(screen.getByAltText('podman environment')).toBeVisible();
  });

  it('renders the Docker icon for AgentOnDocker', () => {
    render(<EnvironmentIcon type={EnvironmentType.AgentOnDocker} />);
    expect(screen.getByAltText('docker environment')).toBeVisible();
  });
});
