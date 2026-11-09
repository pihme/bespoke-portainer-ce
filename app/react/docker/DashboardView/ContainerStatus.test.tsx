import { render, screen } from '@testing-library/react';

import { ContainerStatus } from './ContainerStatus';

describe('ContainerStatus', () => {
  it('renders running, stopped, healthy and unhealthy counts', () => {
    render(
      <ContainerStatus
        stats={{ running: 3, stopped: 1, healthy: 2, unhealthy: 1 }}
      />
    );

    expect(screen.getByText('3 running')).toBeVisible();
    expect(screen.getByText('1 stopped')).toBeVisible();
    expect(screen.getByText('2 healthy')).toBeVisible();
    expect(screen.getByText('1 unhealthy')).toBeVisible();
  });
});
