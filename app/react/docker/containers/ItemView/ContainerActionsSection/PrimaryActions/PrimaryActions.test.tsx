import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/hooks/useUser', () => ({
  Authorized: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('../queries/useStartContainer', () => ({
  useStartContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/useStopContainer', () => ({
  useStopContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/useRestartContainer', () => ({
  useRestartContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/usePauseContainer', () => ({
  usePauseContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/useResumeContainer', () => ({
  useResumeContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/useKillContainer', () => ({
  useKillContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('../queries/useRemoveContainer', () => ({
  useRemoveContainer: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));
vi.mock('@/react/docker/containers/common/confirm-container-delete-modal', () => ({
  confirmContainerDeletion: vi.fn(async () => ({ removeVolumes: true })),
}));

import { notifySuccess } from '@/portainer/services/notifications';
import { useStartContainer } from '../queries/useStartContainer';
import { useStopContainer } from '../queries/useStopContainer';
import { useRestartContainer } from '../queries/useRestartContainer';
import { usePauseContainer } from '../queries/usePauseContainer';
import { useResumeContainer } from '../queries/useResumeContainer';
import { useKillContainer } from '../queries/useKillContainer';
import { useRemoveContainer } from '../queries/useRemoveContainer';
import { confirmContainerDeletion } from '@/react/docker/containers/common/confirm-container-delete-modal';

import { StartButton } from './StartButton';
import { StopButton } from './StopButton';
import { RestartButton } from './RestartButton';
import { PauseButton } from './PauseButton';
import { ResumeButton } from './ResumeButton';
import { KillButton } from './KillButton';
import { RemoveButton } from './RemoveButton';

const base = {
  environmentId: 1 as const,
  containerId: 'abc',
  isRunning: false,
  isPortainer: false,
};

describe('PrimaryActions buttons', () => {
  it('starts a stopped container', async () => {
    const mutate = vi.fn((_: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.()
    );
    vi.mocked(useStartContainer).mockReturnValue({
      mutate,
      isLoading: false,
    } as never);
    const onSuccess = vi.fn();
    render(<StartButton {...base} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByTestId('start-container-button'));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ containerId: 'abc', environmentId: 1 }),
      expect.any(Object)
    );
    expect(notifySuccess).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('stops, restarts, pauses, resumes and kills', async () => {
    const cases = [
      {
        hook: useStopContainer,
        Comp: StopButton,
        cy: 'stop-container-button',
        props: { ...base, isRunning: true },
      },
      {
        hook: useRestartContainer,
        Comp: RestartButton,
        cy: 'restart-container-button',
        props: { ...base, isRunning: true },
      },
      {
        hook: usePauseContainer,
        Comp: PauseButton,
        cy: 'pause-container-button',
        props: { ...base, isRunning: true, isPaused: false },
      },
      {
        hook: useResumeContainer,
        Comp: ResumeButton,
        cy: 'unpause-container-button',
        props: {
          environmentId: 1,
          containerId: 'abc',
          isPaused: true,
          isPortainer: false,
        },
      },
      {
        hook: useKillContainer,
        Comp: KillButton,
        cy: 'kill-container-button',
        props: { ...base, isRunning: true },
      },
    ] as const;

    for (const c of cases) {
      const mutate = vi.fn((_: unknown, opts?: { onSuccess?: () => void }) =>
        opts?.onSuccess?.()
      );
      vi.mocked(c.hook).mockReturnValue({ mutate, isLoading: false } as never);
      const { unmount } = render(<c.Comp {...(c.props as never)} />);
      await userEvent.click(screen.getByTestId(c.cy));
      expect(mutate).toHaveBeenCalled();
      unmount();
    }
  });

  it('removes a container after confirmation', async () => {
    const mutate = vi.fn((_: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.()
    );
    vi.mocked(useRemoveContainer).mockReturnValue({
      mutate,
      isLoading: false,
    } as never);
    vi.mocked(confirmContainerDeletion).mockResolvedValue({
      removeVolumes: true,
    } as never);

    render(<RemoveButton {...base} isRunning />);
    await userEvent.click(screen.getByTestId('remove-container-button'));
    expect(confirmContainerDeletion).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ removeVolumes: true }),
      expect.any(Object)
    );
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('skips remove when confirmation is cancelled', async () => {
    const mutate = vi.fn();
    vi.mocked(useRemoveContainer).mockReturnValue({
      mutate,
      isLoading: false,
    } as never);
    vi.mocked(confirmContainerDeletion).mockResolvedValue(undefined as never);
    render(<RemoveButton {...base} />);
    await userEvent.click(screen.getByTestId('remove-container-button'));
    expect(mutate).not.toHaveBeenCalled();
  });
});
