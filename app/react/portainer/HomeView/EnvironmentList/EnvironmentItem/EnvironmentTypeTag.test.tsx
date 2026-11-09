import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { EnvironmentTypeTag } from './EnvironmentTypeTag';

describe('REQ-ENV-01 EnvironmentTypeTag', () => {
  it('labels a local Docker environment as Local', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.URL = 'unix:///var/run/docker.sock';
    render(<EnvironmentTypeTag environment={environment} />);
    expect(screen.getByText('Local')).toBeVisible();
  });

  it('labels an agent Docker environment as Agent', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.AgentOnDocker;
    environment.URL = 'tcp://agent:9001';
    render(<EnvironmentTypeTag environment={environment} />);
    expect(screen.getByText('Agent')).toBeVisible();
  });
});
