import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Code } from './Code';

const useCopyMock = vi.fn();

vi.mock('@@/buttons/CopyButton/useCopy', () => ({
  useCopy: (...args: unknown[]) => useCopyMock(...args),
}));

vi.mock('@@/buttons', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@@/Icon', () => ({
  Icon: ({ mode }: { mode?: string }) => (
    <span data-cy="copy-icon" data-mode={mode || ''} />
  ),
}));

describe('Code', () => {
  beforeEach(() => {
    useCopyMock.mockReturnValue({
      handleCopy: vi.fn(),
      copiedSuccessfully: false,
    });
  });

  it('displays children text', async () => {
    const children = 'test text code component';
    render(<Code>{children}</Code>);
    expect(await screen.findByText(children)).toBeTruthy();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows copy button and invokes handleCopy', async () => {
    const user = userEvent.setup();
    const handleCopy = vi.fn();
    useCopyMock.mockReturnValue({ handleCopy, copiedSuccessfully: false });
    render(<Code showCopyButton>secret</Code>);
    await user.click(screen.getByRole('button'));
    expect(handleCopy).toHaveBeenCalled();
    expect(screen.getByTestId('copy-icon')).toHaveAttribute('data-mode', '');
  });

  it('shows success icon mode after copy', () => {
    useCopyMock.mockReturnValue({
      handleCopy: vi.fn(),
      copiedSuccessfully: true,
    });
    render(<Code showCopyButton>secret</Code>);
    expect(screen.getByTestId('copy-icon')).toHaveAttribute(
      'data-mode',
      'success'
    );
  });
});
