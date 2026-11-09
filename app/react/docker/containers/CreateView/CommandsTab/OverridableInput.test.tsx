import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { OverridableInput } from './OverridableInput';

describe('REQ-CTR-03 OverridableInput', () => {
  it('toggles between default and override modes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OverridableInput
        value={null}
        onChange={onChange}
        id="command-input"
        placeholder="cmd"
      />
    );

    expect(screen.getByTestId('docker-container-input-command-input')).toBeDisabled();

    await user.click(
      screen.getByTestId('docker-container-override-command-input')
    );
    expect(onChange).toHaveBeenCalledWith('');

    render(
      <OverridableInput
        value="nginx"
        onChange={onChange}
        id="command-input"
        placeholder="cmd"
      />
    );
    await user.click(
      screen.getAllByTestId('docker-container-default-command-input')[0]
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
