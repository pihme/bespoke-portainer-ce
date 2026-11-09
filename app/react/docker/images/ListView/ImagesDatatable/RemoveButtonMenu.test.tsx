import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { RemoveButtonMenu } from './RemoveButtonMenu';

const { mockIsAuthorized, confirmDestructive, deleteImage, notifySuccess } =
  vi.hoisted(() => ({
    mockIsAuthorized: vi.fn(),
    confirmDestructive: vi.fn(),
    deleteImage: vi.fn(async () => undefined),
    notifySuccess: vi.fn(),
  }));

vi.mock('@/react/hooks/useUser', () => ({
  Authorized: ({
    children,
  }: {
    children: React.ReactNode;
  }) => (mockIsAuthorized() ? children : null),
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDestructive: (...args: unknown[]) => confirmDestructive(...args),
}));

vi.mock('../../queries/useDeleteImageMutation', () => ({
  deleteImage: (...args: unknown[]) => deleteImage(...args),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
  notifyError: vi.fn(),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

const images = [
  { id: 'sha256:abc', nodeName: undefined, tags: ['nginx:latest'] },
] as never[];

function renderMenu(selected = images) {
  const Wrapped = withTestQueryProvider(() => (
    <RemoveButtonMenu selectedItems={selected} />
  ));
  return render(<Wrapped />);
}

describe('REQ-IMG-03 RemoveButtonMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthorized.mockReturnValue(true);
    confirmDestructive.mockResolvedValue(true);
  });

  it('disables remove when nothing is selected', () => {
    renderMenu([]);
    expect(screen.getByRole('button', { name: /Remove/i })).toBeDisabled();
  });

  it('removes selected images after confirmation', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /^Remove$/i }));
    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled());
    await waitFor(() => expect(deleteImage).toHaveBeenCalled());
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
  });

  it('does nothing when confirmation is cancelled', async () => {
    confirmDestructive.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /^Remove$/i }));
    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled());
    expect(deleteImage).not.toHaveBeenCalled();
  });
});
