import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableSettingsMenuAutoRefresh } from './TableSettingsMenuAutoRefresh';

describe('TableSettingsMenuAutoRefresh (backwards compatibility)', () => {
  it('enables auto refresh at the default 10s rate', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TableSettingsMenuAutoRefresh value={0} onChange={onChange} />);

    await user.click(screen.getByLabelText('Auto refresh'));
    expect(onChange).toHaveBeenCalledWith(10000);
  });

  it('shows the refresh-rate select when enabled and reports a new rate', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TableSettingsMenuAutoRefresh value={10000} onChange={onChange} />);

    expect(screen.getByLabelText('Refresh rate')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), '30000');
    expect(onChange).toHaveBeenCalledWith(30000);
  });

  it('disables auto refresh when the checkbox is unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TableSettingsMenuAutoRefresh value={10000} onChange={onChange} />);

    await user.click(screen.getByLabelText('Auto refresh'));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
