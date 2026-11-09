import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ConsoleSettings } from './ConsoleSettings';

describe('REQ-CTR-03 ConsoleSettings', () => {
  it('selects console modes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConsoleSettings value="none" onChange={onChange} />);

    await user.click(screen.getByTestId('container-console-tty'));
    expect(onChange).toHaveBeenCalledWith('tty');

    await user.click(screen.getByTestId('container-console-interactive'));
    expect(onChange).toHaveBeenCalledWith('interactive');
  });
});
