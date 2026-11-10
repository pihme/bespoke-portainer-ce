import { render, screen, waitFor } from '@testing-library/react';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import {
  Environment,
  EnvironmentType,
} from '@/react/portainer/environments/types';
import { createMockEnvironment } from '@/react-tools/test-mocks';

import { EnvironmentDetailsForm } from './EnvironmentDetailsForm';

// Mock child form components
vi.mock('./GeneralEnvironmentForm/GeneralEnvironmentForm', () => ({
  GeneralEnvironmentForm: ({
    environment,
    onSuccess,
  }: {
    environment: Environment;
    onSuccess: () => void;
  }) => (
    <div data-cy="general-environment-form">
      GeneralEnvironmentForm: {environment.Name}
      <button type="button" onClick={onSuccess}>
        Submit General
      </button>
    </div>
  ),
}));

// Mock notification service
const mockNotifySuccess = vi.fn();
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (title: string, message: string) =>
    mockNotifySuccess(title, message),
}));

// Mock router
const mockRouterGo = vi.fn();
const mockRouterState = {
  stateService: {
    go: mockRouterGo,
  },
};
const mockStateParams = {
  params: {},
};

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useRouter: () => mockRouterState,
    useCurrentStateAndParams: () => mockStateParams,
  };
});

describe('EnvironmentDetailsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('REQ-TAI-008 renders the general form for a leftover Azure environment', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.Azure,
      Name: 'Azure Test',
    });

    renderComponent({ environment });

    await waitFor(() => {
      const generalForm = screen.getByTestId('general-environment-form');
      expect(generalForm).toBeVisible();
      expect(generalForm).toHaveTextContent('Azure Test');
    });
  });

  it('should render GeneralEnvironmentForm for Docker environment', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.Docker,
      Name: 'Docker Test',
    });

    renderComponent({ environment });

    await waitFor(() => {
      const generalForm = screen.getByTestId('general-environment-form');
      expect(generalForm).toBeVisible();
      expect(generalForm).toHaveTextContent('Docker Test');
    });

    // Should not render other forms
    expect(
      screen.queryByTestId('edge-environment-form')
    ).not.toBeInTheDocument();
  });

  it('should render GeneralEnvironmentForm for Kubernetes environment', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.KubernetesLocal,
      Name: 'K8s Test',
    });

    renderComponent({ environment });

    await waitFor(() => {
      const generalForm = screen.getByTestId('general-environment-form');
      expect(generalForm).toBeVisible();
      expect(generalForm).toHaveTextContent('K8s Test');
    });
  });

  it('should show success notification and navigate on form success', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.Docker,
      Name: 'Test Environment',
    });

    renderComponent({ environment });

    const submitButton = await screen.findByRole('button', {
      name: 'Submit General',
    });
    submitButton.click();

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'Environment updated',
        'Test Environment'
      );
      expect(mockRouterGo).toHaveBeenCalledWith(
        'portainer.endpoints',
        {},
        { reload: true }
      );
    });
  });

  it('should navigate to redirectTo param when provided on success', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.Docker,
      Name: 'Test Environment',
    });

    // Update the mock to return redirectTo param
    mockStateParams.params = { redirectTo: 'docker.dashboard' };

    renderComponent({ environment });

    const submitButton = await screen.findByRole('button', {
      name: 'Submit General',
    });
    submitButton.click();

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalled();
      expect(mockRouterGo).toHaveBeenCalledWith(
        'docker.dashboard',
        {},
        { reload: true }
      );
    });

    // Reset for next test
    mockStateParams.params = {};
  });
});

function renderComponent({ environment }: { environment: Environment }) {
  const Wrapped = withTestQueryProvider(withTestRouter(EnvironmentDetailsForm));

  return render(<Wrapped environment={environment} />);
}
