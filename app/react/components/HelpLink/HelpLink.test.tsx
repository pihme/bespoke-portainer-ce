import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HelpLink } from './HelpLink';

vi.mock('@@/PageHeader/ContextHelp', () => ({
  useDocsUrl: (path: string) => `https://docs.example${path}`,
}));

describe('HelpLink', () => {
  it('renders a docs anchor with default target', () => {
    render(<HelpLink docLink="/user/docker">Read more</HelpLink>);
    const link = screen.getByRole('link', { name: 'Read more' });
    expect(link).toHaveAttribute('href', 'https://docs.example/user/docker');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('allows overriding the target', () => {
    render(
      <HelpLink docLink="/user/edge" target="_self">
        Edge docs
      </HelpLink>
    );
    expect(screen.getByRole('link', { name: 'Edge docs' })).toHaveAttribute(
      'target',
      '_self'
    );
  });
});
