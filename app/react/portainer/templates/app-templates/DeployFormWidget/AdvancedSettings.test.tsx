import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvancedSettings } from './AdvancedSettings';

describe('REQ-TPL-01 AdvancedSettings toggle', () => {
  it('hides children until the toggle is opened', async () => {
    const user = userEvent.setup();
    render(
      <AdvancedSettings
        label={(isOpen) =>
          isOpen ? 'Hide advanced options' : 'Show advanced options'
        }
      >
        <div>advanced body</div>
      </AdvancedSettings>
    );

    expect(screen.queryByText('advanced body')).not.toBeInTheDocument();
    expect(screen.getByText('Show advanced options')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /Show advanced options/i })
    );

    expect(screen.getByText('advanced body')).toBeVisible();
    expect(screen.getByText('Hide advanced options')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /Hide advanced options/i })
    );
    expect(screen.queryByText('advanced body')).not.toBeInTheDocument();
  });
});
