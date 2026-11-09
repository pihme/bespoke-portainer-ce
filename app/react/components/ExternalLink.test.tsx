import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExternalLink } from './ExternalLink';

describe('ExternalLink', () => {
  it('opens the target in a new tab with an icon by default', () => {
    render(
      <ExternalLink to="https://docs.portainer.io" data-cy="docs-link">
        Docs
      </ExternalLink>
    );
    const link = screen.getByRole('link', { name: /Docs/ });
    expect(link).toHaveAttribute('href', 'https://docs.portainer.io');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link.querySelector('svg')).toBeTruthy();
  });

  it('hides the icon when showIcon is false', () => {
    render(
      <ExternalLink
        to="https://example.com"
        data-cy="plain-link"
        showIcon={false}
      >
        Plain
      </ExternalLink>
    );
    expect(screen.getByRole('link', { name: 'Plain' }).querySelector('svg')).toBeNull();
  });
});
