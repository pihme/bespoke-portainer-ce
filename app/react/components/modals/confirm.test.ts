import { vi } from 'vitest';

import {
  confirm,
  confirmChangePassword,
  confirmDelete,
  confirmDestructive,
  confirmGenericDiscard,
  confirmUpdate,
  confirmWebEditorDiscard,
  openConfirm,
} from './confirm';
import { ModalType } from './types';

const openDialog = vi.fn();

vi.mock('./Dialog', () => ({
  openDialog: (...args: unknown[]) => openDialog(...args),
}));

describe('confirm helpers', () => {
  beforeEach(() => {
    openDialog.mockReset();
    openDialog.mockResolvedValue(true);
  });

  it('openConfirm builds cancel+confirm buttons and coerces the result', async () => {
    await expect(
      openConfirm({ title: 'Sure?', message: 'Really?' })
    ).resolves.toBe(true);
    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sure?',
        buttons: expect.arrayContaining([
          expect.objectContaining({ value: false }),
          expect.objectContaining({ value: true }),
        ]),
      })
    );
  });

  it('confirmDestructive sets the destructive modal type', async () => {
    openDialog.mockResolvedValueOnce(false);
    await expect(
      confirmDestructive({ title: 'Delete', message: 'Gone' })
    ).resolves.toBe(false);
    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({ modalType: ModalType.Destructive })
    );
  });

  it('confirm delegates to openConfirm', async () => {
    await expect(confirm({ title: 'Ok', message: 'Go' })).resolves.toBe(true);
  });

  it('covers discard, delete and update helpers', async () => {
    await confirmWebEditorDiscard();
    await confirmGenericDiscard();
    await confirmDelete('remove me');
    const cb = vi.fn();
    await confirmUpdate('update me', cb);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('confirmChangePassword opens a warn dialog', async () => {
    await confirmChangePassword();
    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({ modalType: ModalType.Warn })
    );
  });
});
