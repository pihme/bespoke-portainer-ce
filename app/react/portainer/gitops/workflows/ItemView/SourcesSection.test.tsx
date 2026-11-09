
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UseQueryResult } from '@tanstack/react-query';

import { SourceDetail } from '../../sources/queries/useSource';

import { SourcesSection } from './SourcesSection';

describe('SourcesSection', () => {
  it('renders an unknown source row when the source query errors', () => {
    const errorQuery = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('nope'),
    } as unknown as UseQueryResult<SourceDetail>;

    render(
      <SourcesSection
        sources={[{ sourceId: 7, query: errorQuery }]}
      />
    );

    expect(screen.getByText('Unknown source')).toBeInTheDocument();
    expect(screen.getByText('Sources')).toBeInTheDocument();
  });

  it('renders a loading placeholder while the source query is loading', () => {
    const loadingQuery = {
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as UseQueryResult<SourceDetail>;

    const { container } = render(
      <SourcesSection
        sources={[{ sourceId: 8, query: loadingQuery }]}
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
