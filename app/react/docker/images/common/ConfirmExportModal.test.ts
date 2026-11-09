import { describe, expect, it, vi } from 'vitest';

vi.mock('@@/modals/confirm', () => ({
  openConfirm: vi.fn(async () => true),
}));

vi.mock('@@/modals/utils', () => ({
  buildConfirmButton: (label: string) => ({ label }),
}));

import { openConfirm } from '@@/modals/confirm';

import { confirmImageExport } from './ConfirmExportModal';

describe('confirmImageExport', () => {
  it('opens a caution confirm dialog', async () => {
    await expect(confirmImageExport()).resolves.toBe(true);
    expect(openConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Caution',
        message: expect.stringContaining('export may take several minutes'),
      })
    );
  });
});
