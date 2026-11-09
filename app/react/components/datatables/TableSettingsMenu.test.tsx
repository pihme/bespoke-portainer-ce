import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TableSettingsMenu } from './TableSettingsMenu';

describe('TableSettingsMenu (backwards compatibility)', () => {
  it('opens the settings menu and shows quick actions when provided', async () => {
    const user = userEvent.setup();
    render(
      <TableSettingsMenu quickActions={<span>Quick bit</span>}>
        <span>Child setting</span>
      </TableSettingsMenu>
    );

    await user.click(screen.getByLabelText('Settings'));
    expect(screen.getByText('Table settings')).toBeInTheDocument();
    expect(screen.getByText('Child setting')).toBeInTheDocument();
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(screen.getByText('Quick bit')).toBeInTheDocument();
  });

  it('omits the quick-actions section when none are provided', async () => {
    const user = userEvent.setup();
    render(
      <TableSettingsMenu>
        <span>Only settings</span>
      </TableSettingsMenu>
    );

    await user.click(screen.getByLabelText('Settings'));
    expect(screen.getByText('Only settings')).toBeInTheDocument();
    expect(screen.queryByText('Quick actions')).not.toBeInTheDocument();
  });
});
