import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Stepper } from './Stepper';

describe('Stepper generic wizard chrome', () => {
  it('renders steps with current completed and upcoming states', () => {
    render(
      <Stepper
        currentStepIndex={1}
        steps={[{ label: 'Details' }, { label: 'Configure' }, { label: 'Review' }]}
      />
    );
    expect(
      screen.getByLabelText(/Step 1: Details, completed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Step 2: Configure, current/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Step 3: Review, upcoming/i)
    ).toBeInTheDocument();
  });

  it('invokes onStepClick for completed steps', async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <Stepper
        currentStepIndex={1}
        steps={[{ label: 'Details' }, { label: 'Configure' }, { label: 'Review' }]}
        onStepClick={onStepClick}
      />
    );

    await user.click(screen.getByTestId('stepper-step-0'));
    expect(onStepClick).toHaveBeenCalledWith(0);

    onStepClick.mockClear();
    await user.click(screen.getByTestId('stepper-step-2'));
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('allows clicking an enabled upcoming step', async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <Stepper
        currentStepIndex={0}
        steps={[
          { label: 'Details' },
          { label: 'Configure' },
          { label: 'Review', enabled: true },
        ]}
        onStepClick={onStepClick}
      />
    );
    await user.click(screen.getByTestId('stepper-step-2'));
    expect(onStepClick).toHaveBeenCalledWith(2);
  });
});
