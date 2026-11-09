import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as yup from 'yup';

import { CreateForm } from './CreateForm';
import { WizardProvider, WizardStep } from './WizardContext';

const goToNextStep = vi.fn();
const mutate = vi.fn();
const go = vi.fn();

vi.mock('./useSourceCreateMutation', () => ({
  useCreateSourceMutation: () => ({ mutate, isLoading: false }),
}));
vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));
vi.mock('./WizardHeader', () => ({
  WizardHeader: () => <div>header</div>,
}));
vi.mock('./WizardFooter', () => ({
  WizardFooter: () => (
    <button type="submit">Next</button>
  ),
}));
vi.mock('@@/Widget', () => ({
  Widget: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const step: WizardStep = {
  id: 'configure',
  label: 'Configure',
  component: () => <div>step-body</div>,
  validateStep: () => yup.object(),
};

describe('REQ-GIT-02 CreateForm', () => {
  it('advances to the next wizard step when not on the last step', async () => {
    const user = userEvent.setup();
    const context = {
      currentStep: step,
      currentStepIndex: 0,
      isFirstStep: true,
      isLastStep: false,
      canGoBack: false,
      canGoForward: true,
      goToNextStep,
      goToPreviousStep: vi.fn(),
      goToStep: vi.fn(),
      goToStepByIndex: vi.fn(),
    };
    render(
      <WizardProvider context={context}>
        <CreateForm steps={[step]} />
      </WizardProvider>
    );
    expect(screen.getByText('step-body')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(goToNextStep).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submits the create mutation on the last step', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_payload, opts) => {
      opts?.onSuccess?.();
      opts?.onSettled?.();
    });
    const context = {
      currentStep: step,
      currentStepIndex: 1,
      isFirstStep: false,
      isLastStep: true,
      canGoBack: true,
      canGoForward: false,
      goToNextStep,
      goToPreviousStep: vi.fn(),
      goToStep: vi.fn(),
      goToStepByIndex: vi.fn(),
    };
    render(
      <WizardProvider context={context}>
        <CreateForm steps={[step]} />
      </WizardProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(mutate).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('.^');
  });
});
