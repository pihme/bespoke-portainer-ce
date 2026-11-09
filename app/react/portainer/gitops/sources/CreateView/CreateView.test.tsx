import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CreateView } from './CreateView';

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@@/Stepper/useWizardSteps', () => ({
  useWizardSteps: ({ steps }: { steps: unknown[] }) => ({
    currentStep: (steps as { id: string; component: () => null }[])[0],
    currentStepIndex: 0,
    isFirstStep: true,
    isLastStep: false,
    canGoBack: false,
    canGoForward: true,
    goToNextStep: vi.fn(),
    goToPreviousStep: vi.fn(),
    goToStep: vi.fn(),
    goToStepByIndex: vi.fn(),
  }),
}));
vi.mock('./CreateForm', () => ({
  CreateForm: () => <div data-cy="create-form">form</div>,
}));
vi.mock('./steps/ConfigureStep', () => ({
  ConfigureStep: () => null,
  validateConfigureStep: () => ({}),
}));
vi.mock('./steps/AccessControlStep', () => ({
  AccessControlStep: () => null,
  validateAccessControlStep: () => ({}),
}));

describe('REQ-GIT-02 CreateView', () => {
  it('renders the create source header and form', () => {
    render(<CreateView />);
    expect(screen.getByText('Create Source')).toBeVisible();
    expect(screen.getByTestId('create-form')).toBeVisible();
  });
});
