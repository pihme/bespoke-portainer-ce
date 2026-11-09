import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublishedPortLink } from './PublishedPortLink';

describe('PublishedPortLink for local container ports', () => {
  it('builds http URLs by default and https when container port ends with 443', () => {
    const { rerender } = render(
      <PublishedPortLink hostURL="example.com/" hostPort={8080} containerPort={80} />
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'http://example.com:8080'
    );
    expect(screen.getByText('8080:80')).toBeInTheDocument();

    rerender(
      <PublishedPortLink
        hostURL="example.com"
        hostPort={8443}
        containerPort={443}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://example.com:8443'
    );
  });

  it('keeps an existing scheme and handles missing host URL', () => {
    const { rerender } = render(
      <PublishedPortLink
        hostURL="https://Example.com/"
        hostPort={90}
        containerPort={90}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://example.com:90'
    );

    rerender(
      <PublishedPortLink hostPort={1} containerPort={2} />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', 'http://:1');
  });
});
