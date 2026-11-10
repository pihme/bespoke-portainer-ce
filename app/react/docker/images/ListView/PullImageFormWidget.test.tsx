import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { useAuthorizations } from '@/react/hooks/useUser';

import { usePullImageMutation } from '../queries/usePullImageMutation';

import { PullImageFormWidget } from './PullImageFormWidget';

// Mocks
vi.mock(
  '@/react/hooks/useUser',
  async (importOriginal: () => Promise<object>) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useAuthorizations: vi.fn(),
    };
  }
);

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('../queries/usePullImageMutation', () => ({
  usePullImageMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock('@@/ImageConfigFieldset/getImageConfig', () => ({
  getDefaultImageConfig: () => ({
    image: '',
  }),
}));

// Mock child components to simplify tests
vi.mock('./PullImageFormWidget.Form', () => ({
  PullImageForm: (props: { isLoading: boolean }) => (
    <form data-cy="pull-image-form" data-props={Object.keys(props).join(',')}>
      <input aria-label="Image name" name="image" data-cy="image-input" />
      <button
        type="submit"
        disabled={props.isLoading}
        data-cy="pull-image-button"
      >
        {props.isLoading ? 'Download in progress...' : 'Pull the image'}
      </button>
    </form>
  ),
}));

describe('PullImageFormWidget', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should render widget when user has DockerImageCreate authorization', () => {
      vi.mocked(useAuthorizations).mockReturnValue({
        authorized: true,
        isLoading: false,
      });

      renderComponent();

      expect(
        screen.getByRole('heading', { name: /pull image/i })
      ).toBeVisible();
      expect(screen.getByTestId('pull-image-form')).toBeVisible();
    });

    it('should not render when user lacks DockerImageCreate authorization', () => {
      vi.mocked(useAuthorizations).mockReturnValue({
        authorized: false,
        isLoading: false,
      });

      renderComponent();

      expect(
        screen.queryByRole('heading', { name: /pull image/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('pull-image-form')).not.toBeInTheDocument();
    });
  });

  describe('Form Rendering', () => {
    beforeEach(() => {
      vi.mocked(useAuthorizations).mockReturnValue({
        authorized: true,
        isLoading: false,
      });
    });

    it('should render widget with title "Pull image"', () => {
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /pull image/i })
      ).toBeVisible();
    });

    it('REQ-TAI-007 renders no node selector and passes no node visibility', () => {
      renderComponent();

      expect(screen.queryByLabelText(/node/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('pull-image-form')).toHaveAttribute(
        'data-props',
        'isLoading'
      );
    });
  });

  describe('Mutation Hook Setup', () => {
    beforeEach(() => {
      vi.mocked(useAuthorizations).mockReturnValue({
        authorized: true,
        isLoading: false,
      });
    });

    it('should initialize usePullImageMutation with correct environment ID', async () => {
      const mockUsePullImageMutation = vi.mocked(usePullImageMutation);

      renderComponent();

      // Verify mutation hook was called with environment ID 1
      expect(mockUsePullImageMutation).toHaveBeenCalledWith(1);
    });

    it('should show loading state during pull operation', async () => {
      vi.mocked(usePullImageMutation).mockReturnValue({
        mutate: vi.fn(),
        isLoading: true,
      } as unknown as ReturnType<typeof usePullImageMutation>);

      renderComponent();

      const submitButton = screen.getByRole('button', {
        name: /download in progress/i,
      });
      expect(submitButton).toBeVisible();
      expect(submitButton).toBeDisabled();
    });
  });
});

function renderComponent() {
  const Wrapped = withTestQueryProvider(withTestRouter(PullImageFormWidget));
  return render(<Wrapped />);
}
