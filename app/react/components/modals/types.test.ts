import { ModalType } from './types';

describe('ModalType', () => {
  it('exposes warn and destructive values', () => {
    expect(ModalType.Warn).toBe('warning');
    expect(ModalType.Destructive).toBe('error');
  });
});
