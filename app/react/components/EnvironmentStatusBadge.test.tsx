import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import {
  EnvironmentStatus,
  EnvironmentType,
} from '@/react/portainer/environments/types';

import { EnvironmentStatusBadge } from './EnvironmentStatusBadge';

describe('EnvironmentStatusBadge', () => {
  it('shows Up for a local Docker environment that is up', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Status = EnvironmentStatus.Up;
    render(<EnvironmentStatusBadge environment={environment} />);
    expect(screen.getByLabelText('status-badge')).toHaveTextContent('Up');
  });

  it('shows Down for a local Docker environment that is down', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Status = EnvironmentStatus.Down;
    render(<EnvironmentStatusBadge environment={environment} />);
    expect(screen.getByLabelText('status-badge')).toHaveTextContent('Down');
  });
});
