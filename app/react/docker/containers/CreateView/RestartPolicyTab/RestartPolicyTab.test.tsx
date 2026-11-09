import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { RestartPolicyTab } from './RestartPolicyTab';
import { RestartPolicy } from './types';

describe('REQ-CTR-03 RestartPolicyTab', () => {
  it('lets the user pick a restart policy', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RestartPolicyTab values={RestartPolicy.No} onChange={onChange} />);

    await user.click(screen.getByTestId('button-selector-option-always'));
    expect(onChange).toHaveBeenCalledWith(RestartPolicy.Always);

    await user.click(
      screen.getByTestId('button-selector-option-unless-stopped')
    );
    expect(onChange).toHaveBeenCalledWith(RestartPolicy.UnlessStopped);
  });
});
