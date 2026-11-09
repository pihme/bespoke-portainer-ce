import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvancedForm } from './AdvancedForm';

describe('REQ-IMG-02 AdvancedForm', () => {
  it('updates the free-form image and notifies onChangeImage', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    const onChangeImage = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <AdvancedForm
        values={{ useRegistry: false, image: '', registryId: 0 }}
        setFieldValue={setFieldValue}
        onChangeImage={onChangeImage}
      />
    );

    await user.type(screen.getByLabelText('Image'), 'nginx:latest');
    expect(setFieldValue).toHaveBeenCalledWith('image', expect.any(String));
    await vi.runAllTimersAsync();
    expect(onChangeImage).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
