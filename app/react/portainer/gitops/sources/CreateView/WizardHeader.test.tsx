import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import * as yup from 'yup';

import { WizardProvider, WizardStep } from './WizardContext';
import { WizardHeader } from './WizardHeader';

vi.mock('@@/Stepper/Stepper', () => ({
  Stepper: ({
    steps,
    currentStepIndex,
  }: {
    steps: WizardStep[];
    currentStepIndex: number;
  }) => (
    <div data-cy="stepper">
      {steps[currentStepIndex]?.label}
    </div>
  ),
}));

const steps: WizardStep[] = [
  {
    id: 'configure',
    label: 'Configure connection',
    component: () => null,
    validateStep: () => yup.object(),
  },
];

describe('REQ-GIT-02 WizardHeader', () => {
  it('renders the current step label', () => {
    const context = {
      currentStep: steps[0],
      currentStepIndex: 0,
      isFirstStep: true,
      isLastStep: true,
      canGoBack: false,
      canGoForward: false,
      goToNextStep: vi.fn(),
      goToPreviousStep: vi.fn(),
      goToStep: vi.fn(),
      goToStepByIndex: vi.fn(),
    };
    render(
      <WizardProvider context={context}>
        <WizardHeader steps={steps} />
      </WizardProvider>
    );
    expect(screen.getByText('Configure connection')).toBeVisible();
  });
});
