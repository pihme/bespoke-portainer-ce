import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders title/message and submits a button value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Dialog
        title="Confirm"
        message="Are you sure?"
        onSubmit={onSubmit}
        buttons={[
          { label: 'OK', value: true, color: 'primary', dataCy: 'ok-btn' },
        ]}
      />
    );
    expect(screen.getByText('Are you sure?')).toBeVisible();
    await user.click(screen.getByTestId('ok-btn'));
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it('falls back to a Dialog aria-label for non-string titles', () => {
    render(
      <Dialog
        title={<span>X</span>}
        message={<span>Y</span>}
        onSubmit={() => {}}
        buttons={[]}
      />
    );
    expect(screen.getByLabelText('Dialog')).toBeVisible();
  });
});
