import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DockerfileDetails } from './DockerfileDetails';

const openModal = vi.fn();

vi.mock('@@/modals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@@/modals')>();
  return {
    ...actual,
    openModal: (...args: unknown[]) => openModal(...args),
  };
});

describe('REQ-IMG DockerfileDetails', () => {
  it('renders CMD dash when command is null and hides empty sections', () => {
    render(
      <DockerfileDetails
        image={{
          Command: null,
          Entrypoint: undefined as never,
          ExposedPorts: [],
          Volumes: [],
          Env: [],
        }}
      />
    );
    expect(screen.getByText('CMD')).toBeVisible();
    expect(screen.getByText('-')).toBeVisible();
    expect(screen.queryByText('ENTRYPOINT')).not.toBeInTheDocument();
    expect(screen.queryByText('EXPOSE')).not.toBeInTheDocument();
  });

  it('renders command entrypoint ports volumes and env', () => {
    render(
      <DockerfileDetails
        image={{
          Command: ['nginx', '-g', 'daemon off;'],
          Entrypoint: ['/docker-entrypoint.sh'],
          ExposedPorts: [80, 443],
          Volumes: ['/data', '/logs'],
          Env: ['PATH=/usr/bin', 'HOME=/root'],
        }}
      />
    );
    expect(screen.getByText('ENTRYPOINT')).toBeVisible();
    expect(screen.getByText('80')).toBeVisible();
    expect(screen.getByText('/data')).toBeVisible();
    expect(screen.getByText('PATH')).toBeVisible();
    expect(screen.getByText('/usr/bin')).toBeVisible();
  });
});

describe('selectRegistry (registries deferred-within-package)', () => {
  it('opens the registry modal with defaults', async () => {
    openModal.mockResolvedValue(2);
    const { selectRegistry } = await import('./RegistrySelectPrompt');
    const registries = [
      { Id: 1, Name: 'dockerhub' },
      { Id: 2, Name: 'ghcr' },
    ] as never[];
    await expect(selectRegistry(registries, 1)).resolves.toBe(2);
    expect(openModal).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ defaultValue: 1, registries })
    );

    // Render the prompt component passed to openModal for KEEP-adjacent coverage
    const Prompt = openModal.mock.calls[0][0] as React.ComponentType<{
      registries: typeof registries;
      defaultValue: number;
      onSubmit: (id?: number) => void;
    }>;
    const onSubmit = vi.fn();
    render(
      <Prompt registries={registries} defaultValue={1} onSubmit={onSubmit} />
    );
    expect(
      screen.getByText(/which registry do you want to use/i)
    ).toBeVisible();
    await userEvent.click(
      screen.getByTestId('registry-select-cancel-button')
    );
    expect(onSubmit).toHaveBeenCalledWith();
    await userEvent.click(
      screen.getByTestId('registry-select-update-button')
    );
    expect(onSubmit).toHaveBeenCalledWith(1);
  });
});
