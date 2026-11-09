import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeploymentInfo } from './DeploymentInfo';

describe('DeploymentInfo', () => {
  it('shows the default docker compose tip for standalone stacks', () => {
    render(<DeploymentInfo isSwarm={false} />);
    expect(screen.getByText(/docker compose/)).toBeInTheDocument();
    expect(screen.queryByText(/docker stack deploy/)).not.toBeInTheDocument();
  });

  it('shows the compose v2 limitation tip when composeSyntaxMaxVersion is 2', () => {
    render(<DeploymentInfo isSwarm={false} composeSyntaxMaxVersion={2} />);
    expect(
      screen.getByText(/Only Compose file format version/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/limitation of libcompose/i)
    ).toBeInTheDocument();
  });
});
