import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { EnvVarsTab } from './EnvVarsTab';

describe('REQ-CTR-03 EnvVarsTab', () => {
  it('adds an environment variable row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EnvVarsTab values={[]} onChange={onChange} />);

    expect(
      screen.getByText(/applied to the container when deployed/i)
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /add an environment variable/i })
    );
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '', value: '' }),
      ])
    );
  });
});
