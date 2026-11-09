import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockUseSref = vi.hoisted(() =>
  vi.fn(() => ({
    href: '#/docker/containers',
    onClick: vi.fn(),
  }))
);

vi.mock('@uirouter/react', () => ({
  useSref: mockUseSref,
}));

import { Link } from './Link';

describe('Link', () => {
  it('renders an anchor with href and data-cy from useSref', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    mockUseSref.mockReturnValue({ href: '#/docker/containers', onClick });

    render(
      <Link to="docker.containers" data-cy="containers-link" title="Containers">
        Containers
      </Link>
    );

    const anchor = screen.getByRole('link', { name: 'Containers' });
    expect(anchor).toHaveAttribute('href', '#/docker/containers');
    expect(anchor).toHaveAttribute('data-cy', 'containers-link');
    expect(anchor).toHaveAttribute('title', 'Containers');
    expect(mockUseSref).toHaveBeenCalledWith(
      'docker.containers',
      undefined,
      undefined
    );

    await user.click(anchor);
    expect(onClick).toHaveBeenCalled();
  });
});
