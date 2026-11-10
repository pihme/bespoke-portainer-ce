import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  params: {
    envType: 'dockerStandalone',
    localEndpointId: undefined as string | undefined,
    referrer: undefined as string | undefined,
    step: undefined as string | undefined,
  },
}));

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({ params: state.params }),
  useRouter: () => ({ stateService: { go: vi.fn() } }),
  useSref: () => ({ href: '#', onClick: vi.fn() }),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('./WizardDocker', () => ({
  WizardDocker: () => <div data-cy="wizard-docker">docker wizard</div>,
}));

vi.mock('./WizardPodman', () => ({
  WizardPodman: () => <div>podman</div>,
}));

vi.mock('./WizardEndpointsList', () => ({
  WizardEndpointsList: () => <div data-cy="endpoints-list">list</div>,
}));

vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: () => ({ isPureAdmin: true }),
}));

import { EnvironmentCreationView } from './EnvironmentsCreationView';

describe('EnvironmentCreationView', () => {
  it('renders the Docker wizard for a dockerStandalone step', () => {
    state.params = {
      envType: 'dockerStandalone',
      localEndpointId: undefined,
      referrer: undefined,
      step: undefined,
    };
    render(<EnvironmentCreationView />);
    expect(screen.getByText('Quick Setup')).toBeVisible();
    expect(screen.getByTestId('wizard-docker')).toBeVisible();
    expect(screen.getByTestId('endpoints-list')).toBeVisible();
  });
});
