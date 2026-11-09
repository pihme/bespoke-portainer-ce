import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { AgentDetails } from './AgentDetails';

describe('REQ-ENV-01 AgentDetails', () => {
  it('returns null for a non-agent local Docker environment', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    const { container } = render(<AgentDetails environment={environment} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the agent version when it is up to date', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.AgentOnDocker;
    environment.Agent = { Version: '2.20.0', IsOutdated: false } as never;
    render(<AgentDetails environment={environment} />);
    expect(screen.getByText('2.20.0')).toBeVisible();
  });

  it('warns when the agent version is outdated', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.AgentOnDocker;
    environment.Agent = { Version: '', IsOutdated: true } as never;
    render(<AgentDetails environment={environment} />);
    expect(screen.getByText('< 2.15')).toBeVisible();
  });
});
