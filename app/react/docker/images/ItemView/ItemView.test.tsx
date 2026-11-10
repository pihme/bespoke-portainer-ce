import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DockerfileDetails } from './DockerfileDetails';

describe('REQ-IMG DockerfileDetails', () => {
  it('renders CMD dash when command is null and hides empty sections', () => {
    render(
      <DockerfileDetails
        image={{
          Command: null,
          Entrypoint: undefined as never,
          ExposedPorts: [],
          Volumes: [],
          Env: [],
        }}
      />
    );
    expect(screen.getByText('CMD')).toBeVisible();
    expect(screen.getByText('-')).toBeVisible();
    expect(screen.queryByText('ENTRYPOINT')).not.toBeInTheDocument();
    expect(screen.queryByText('EXPOSE')).not.toBeInTheDocument();
  });

  it('renders command entrypoint ports volumes and env', () => {
    render(
      <DockerfileDetails
        image={{
          Command: ['nginx', '-g', 'daemon off;'],
          Entrypoint: ['/docker-entrypoint.sh'],
          ExposedPorts: [80, 443],
          Volumes: ['/data', '/logs'],
          Env: ['PATH=/usr/bin', 'HOME=/root'],
        }}
      />
    );
    expect(screen.getByText('ENTRYPOINT')).toBeVisible();
    expect(screen.getByText('80')).toBeVisible();
    expect(screen.getByText('/data')).toBeVisible();
    expect(screen.getByText('PATH')).toBeVisible();
    expect(screen.getByText('/usr/bin')).toBeVisible();
  });
});
