import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GitCommitLink } from './GitCommitLink';

describe('GitCommitLink (backwards compatibility)', () => {
  it('builds a Bitbucket commits URL and trims trailing slash/.git', () => {
    render(
      <GitCommitLink
        baseURL="https://bitbucket.org/org/repo.git/"
        commitHash="abcdef1234567890"
      />
    );
    const link = screen.getByRole('link', { name: 'abcdef1' });
    expect(link).toHaveAttribute(
      'href',
      'https://bitbucket.org/org/repo/commits/abcdef1234567890'
    );
  });

  it('falls back to /commit/ for GitHub-style repos', () => {
    render(
      <GitCommitLink
        baseURL="https://github.com/org/repo"
        commitHash="1234567890abcdef"
      />
    );
    expect(screen.getByRole('link', { name: '1234567' })).toHaveAttribute(
      'href',
      'https://github.com/org/repo/commit/1234567890abcdef'
    );
  });
});
