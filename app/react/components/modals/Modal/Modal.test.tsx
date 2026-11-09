import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Modal } from './index';
import { useModalContext } from './Modal';
import { CloseButton } from './CloseButton';
import { ModalType } from './types';

function ContextProbe() {
  useModalContext();
  return <span>inside-modal</span>;
}

describe('Modal', () => {
  it('renders children and aria-label', () => {
    render(
      <Modal aria-label="demo-modal">
        <span>hello modal</span>
      </Modal>
    );
    expect(screen.getByLabelText('demo-modal')).toBeVisible();
    expect(screen.getByText('hello modal')).toBeVisible();
  });

  it('shows close button and calls onDismiss when clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Modal aria-label="dismissable" onDismiss={onDismiss}>
        content
      </Modal>
    );
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('omits close button when onDismiss is not provided', () => {
    render(
      <Modal aria-label="no-dismiss">
        content
      </Modal>
    );
    expect(screen.queryByRole('button', { name: '×' })).toBeNull();
  });

  it('applies size class variants', () => {
    const { rerender } = render(
      <Modal aria-label="sized" size="md">
        md
      </Modal>
    );
    expect(screen.getByLabelText('sized').className).toContain('w-[450px]');

    rerender(
      <Modal aria-label="sized" size="lg">
        lg
      </Modal>
    );
    expect(screen.getByLabelText('sized').className).toContain('w-[700px]');

    rerender(
      <Modal aria-label="sized" size="xl">
        xl
      </Modal>
    );
    expect(screen.getByLabelText('sized').className).toContain('w-[1000px]');
  });

  it('forwards aria-labelledby, className and dialogClassName', () => {
    render(
      <Modal
        aria-labelledby="title-id"
        className="custom-content"
        dialogClassName="custom-dialog"
      >
        <h5 id="title-id">Titled</h5>
      </Modal>
    );
    const dialog = screen.getByLabelText('Titled');
    expect(dialog.className).toContain('custom-dialog');
    expect(dialog.querySelector('.custom-content')).not.toBeNull();
  });

  it('exposes Header Body Footer subcomponents', () => {
    render(
      <Modal aria-label="composed">
        <Modal.Header title="Header title" />
        <Modal.Body>Body copy</Modal.Body>
        <Modal.Footer>
          <button type="button">OK</button>
        </Modal.Footer>
      </Modal>
    );
    expect(screen.getByText('Header title')).toBeVisible();
    expect(screen.getByText('Body copy')).toBeVisible();
    expect(screen.getByRole('button', { name: 'OK' })).toBeVisible();
  });

  it('renders ModalHeader string and node titles with modal types', () => {
    const { rerender } = render(
      <Modal aria-label="header">
        <Modal.Header title="Warn title" modalType={ModalType.Warn} />
      </Modal>
    );
    expect(screen.getByText('Warn title')).toBeVisible();

    rerender(
      <Modal aria-label="header">
        <Modal.Header
          title={<span>Node title</span>}
          modalType={ModalType.Destructive}
        />
      </Modal>
    );
    expect(screen.getByText('Node title')).toBeVisible();
  });

  it('provides modal context to nested children', () => {
    render(
      <Modal aria-label="ctx">
        <ContextProbe />
      </Modal>
    );
    expect(screen.getByText('inside-modal')).toBeVisible();
  });

  it('throws when useModalContext is used outside Modal', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ContextProbe />)).toThrow(
      'should be nested under Modal'
    );
    spy.mockRestore();
  });

  it('CloseButton invokes onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloseButton onClose={onClose} className="extra" />);
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('exports ModalType enum values', () => {
    expect(ModalType.Warn).toBe('warning');
    expect(ModalType.Destructive).toBe('error');
  });
});
