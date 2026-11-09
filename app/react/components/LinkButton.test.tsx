import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@uirouter/react', () => ({
  useSref: () => ({ href: '#/docker/networks/new', onClick: vi.fn() }),
}));

import { LinkButton } from './LinkButton';

describe('LinkButton', () => {
  it('renders as a link button when enabled', () => {
    render(
      <LinkButton to="docker.networks.new" data-cy="add-network">
        Add network
      </LinkButton>
    );
    expect(screen.getByText('Add network')).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '#/docker/networks/new'
    );
  });

  it('renders as a non-link span when disabled', () => {
    render(
      <LinkButton to="docker.networks.new" data-cy="add-network" disabled>
        Add network
      </LinkButton>
    );
    expect(screen.getByText('Add network')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
