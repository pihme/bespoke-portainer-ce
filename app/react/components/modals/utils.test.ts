import { buildCancelButton, buildConfirmButton } from './utils';

describe('modal button builders', () => {
  it('builds confirm and cancel buttons with defaults and overrides', () => {
    expect(buildConfirmButton()).toEqual({
      label: 'Confirm',
      color: 'primary',
      value: true,
      timeout: 0,
      dataCy: 'modal-confirm-button',
    });
    expect(buildConfirmButton('Remove', 'danger', 2, 'rm')).toEqual({
      label: 'Remove',
      color: 'danger',
      value: true,
      timeout: 2,
      dataCy: 'rm',
    });
    expect(buildCancelButton()).toEqual({
      label: 'Cancel',
      color: 'default',
      value: false,
      dataCy: 'modal-cancel-button',
    });
    expect(buildCancelButton('No', 'no-btn')).toEqual({
      label: 'No',
      color: 'default',
      value: false,
      dataCy: 'no-btn',
    });
  });
});
