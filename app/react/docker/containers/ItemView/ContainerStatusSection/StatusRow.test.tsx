import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContainerDetailsViewModel } from '@/docker/models/containerDetails';

import { StatusRow } from './StatusRow';

function makeContainer(
  state: Partial<ContainerDetailsViewModel['State']> & Record<string, unknown>,
  created?: string
): ContainerDetailsViewModel {
  return {
    Id: 'c1',
    Name: '/c1',
    Created: created,
    State: state as ContainerDetailsViewModel['State'],
  } as ContainerDetailsViewModel;
}

describe('StatusRow', () => {
  it('renders running state', () => {
    render(
      <StatusRow
        container={makeContainer({
          Running: true,
          Status: 'running',
          StartedAt: '2024-01-01T10:00:00Z',
          ExitCode: 0,
        })}
      />
    );
    expect(screen.getByText(/Running for/)).toBeInTheDocument();
  });

  it('renders paused, dead, ghost, created and stopped states', () => {
    const { rerender } = render(
      <StatusRow
        container={makeContainer({
          Running: true,
          Paused: true,
          Status: 'paused',
          StartedAt: '2024-01-01T10:00:00Z',
        })}
      />
    );
    expect(screen.getByText(/Running \(Paused\) for/)).toBeInTheDocument();

    rerender(
      <StatusRow
        container={makeContainer({
          Dead: true,
          Running: false,
          Status: 'dead',
          FinishedAt: '2024-01-01T11:00:00Z',
          ExitCode: 1,
        })}
      />
    );
    expect(screen.getByText(/Dead for/)).toBeInTheDocument();
    expect(screen.getByText(/exit code 1/)).toBeInTheDocument();

    rerender(
      <StatusRow
        container={makeContainer({
          Running: true,
          Ghost: true,
          Status: 'running',
          StartedAt: '2024-01-01T10:00:00Z',
        })}
      />
    );
    expect(screen.getByText(/Ghost for/)).toBeInTheDocument();

    rerender(
      <StatusRow
        container={makeContainer(
          { Running: false, Status: 'created' },
          '2024-01-01T09:00:00Z'
        )}
      />
    );
    expect(screen.getByText(/Created for/)).toBeInTheDocument();

    rerender(
      <StatusRow
        container={makeContainer({
          Running: false,
          Status: 'exited',
          FinishedAt: '2024-01-01T12:00:00Z',
          ExitCode: 2,
        })}
      />
    );
    expect(screen.getByText(/Stopped for/)).toBeInTheDocument();
  });

  it('handles missing state', () => {
    render(
      <StatusRow
        container={
          { Id: 'c1', Name: '/c1', State: undefined } as ContainerDetailsViewModel
        }
      />
    );
    expect(screen.getByText(/for/)).toBeInTheDocument();
  });
});
