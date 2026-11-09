import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { UserViewModel } from '@/portainer/models/user';

const useWorkflow = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({ params: { workflowId: 1 } }),
  useRouter: () => ({ stateService: { go: vi.fn() } }),
}));

vi.mock('../queries/useWorkflow', () => ({
  useWorkflow: (...args: unknown[]) => useWorkflow(...args),
}));

import { ItemView } from './ItemView';

describe('ItemView error state', () => {
  beforeEach(() => {
    useWorkflow.mockReset();
  });

  it('shows the workflow load failure alert', async () => {
    useWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
    });
    const user = new UserViewModel({ Username: 'user', Role: 1 });
    const Wrapped = withTestQueryProvider(
      withUserProvider(withTestRouter(ItemView), user)
    );
    render(<Wrapped />);
    expect(
      await screen.findByText(/Failed loading workflow:\s*network down/i)
    ).toBeInTheDocument();
  });

  it('falls back to Unknown error when error is not an Error', async () => {
    useWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: 'string-error',
    });
    const user = new UserViewModel({ Username: 'user', Role: 1 });
    const Wrapped = withTestQueryProvider(
      withUserProvider(withTestRouter(ItemView), user)
    );
    render(<Wrapped />);
    expect(
      await screen.findByText(/Failed loading workflow:\s*Unknown error/i)
    ).toBeInTheDocument();
  });
});
