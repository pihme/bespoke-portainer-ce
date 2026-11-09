import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';

const mutate = vi.fn();
const go = vi.fn();
const confirmContainerRecreation = vi.fn();
const notifySuccess = vi.fn();

vi.mock('../queries/useRecreateContainer', () => ({
  useRecreateContainer: () => ({ mutate, isLoading: false }),
}));

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useRouter: () => ({ stateService: { go } }),
}));

vi.mock('@/react/docker/containers/ItemView/ConfirmRecreationModal', () => ({
  confirmContainerRecreation: (...args: unknown[]) =>
    confirmContainerRecreation(...args),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

import { RecreateButton } from './RecreateButton';

function renderButton(
  props: Partial<React.ComponentProps<typeof RecreateButton>> = {}
) {
  const Wrapped = withTestQueryProvider(
    withTestRouter(() => (
      <RecreateButton
        environmentId={1}
        containerId="cid"
        containerImage="nginx:latest"
        isPortainer={false}
        {...props}
      />
    ))
  );
  return render(<Wrapped />);
}

describe('RecreateButton', () => {
  beforeEach(() => {
    mutate.mockReset();
    go.mockReset();
    confirmContainerRecreation.mockReset();
    notifySuccess.mockReset();
  });

  it('does nothing when recreation is cancelled', async () => {
    confirmContainerRecreation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByTestId('recreate-container-button'));
    await waitFor(() => expect(confirmContainerRecreation).toHaveBeenCalled());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('recreates after confirm and notifies success', async () => {
    confirmContainerRecreation.mockResolvedValue({ pullLatest: true });
    mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.();
    });
    const user = userEvent.setup();
    renderButton({ containerImage: 'sha256:deadbeef' });
    await user.click(screen.getByTestId('recreate-container-button'));
    await waitFor(() =>
      expect(confirmContainerRecreation).toHaveBeenCalledWith(true)
    );
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('docker.containers', {}, { reload: true });
  });

  it('disables for the Portainer container', () => {
    renderButton({ isPortainer: true });
    expect(screen.getByTestId('recreate-container-button')).toBeDisabled();
  });
});
