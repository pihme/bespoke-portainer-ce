import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { TestConnectionButton } from './TestConnectionButton';

const mutate = vi.fn();
const mutationState: {
  isLoading: boolean;
  isSuccess: boolean;
  data: { success: boolean; error?: string } | undefined;
  mutate: typeof mutate;
} = {
  isLoading: false,
  isSuccess: false,
  data: undefined,
  mutate,
};

vi.mock('../queries/useTestSourceConnectionMutation', () => ({
  useTestSourceConnectionMutation: () => mutationState,
}));

function renderButton(showError?: boolean) {
  const Wrapped = withTestQueryProvider(() => (
    <TestConnectionButton
      sourceId={9}
      data-cy="test-connection"
      showError={showError}
      payload={{ name: 'changed' }}
    />
  ));
  return render(<Wrapped />);
}

describe('REQ-GIT-01 TestConnectionButton', () => {
  beforeEach(() => {
    mutate.mockReset();
    mutationState.isLoading = false;
    mutationState.isSuccess = false;
    mutationState.data = undefined;
  });

  it('TestREQ_GIT_01_triggers_connection_test_with_optional_payload', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByTestId('test-connection'));

    expect(mutate).toHaveBeenCalledWith({
      id: 9,
      payload: { name: 'changed' },
    });
  });

  it('TestREQ_GIT_01_shows_success_icon_when_connection_succeeds', () => {
    mutationState.isSuccess = true;
    mutationState.data = { success: true };

    renderButton();

    expect(screen.getByText('Connection successful')).toBeInTheDocument();
  });

  it('TestREQ_GIT_01_shows_inline_error_when_showError_is_set', () => {
    mutationState.isSuccess = true;
    mutationState.data = { success: false, error: 'auth failed' };

    renderButton(true);

    expect(screen.getByRole('alert')).toHaveTextContent('auth failed');
  });

  it('TestREQ_GIT_01_shows_tooltip_error_icon_by_default', async () => {
    mutationState.isSuccess = true;
    mutationState.data = { success: false, error: 'unreachable' };

    renderButton(false);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('unreachable')).toBeInTheDocument();
  });

  it('TestREQ_GIT_01_falls_back_to_connection_failed_message', () => {
    mutationState.isSuccess = true;
    mutationState.data = { success: false };

    renderButton(true);

    expect(screen.getByRole('alert')).toHaveTextContent('Connection failed');
  });

  it('TestREQ_GIT_01_shows_loading_label_while_testing', async () => {
    mutationState.isLoading = true;
    renderButton();

    await waitFor(() => {
      expect(screen.getByText('Testing connection...')).toBeVisible();
    });
  });
});
