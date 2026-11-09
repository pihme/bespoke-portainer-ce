import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { createMockStack } from '@/react-tools/test-mocks';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';
import { ExternalStackViewModel } from '@/react/docker/stacks/view-models/external-stack';

import { TableActions } from './TableActions';
import { DecoratedStack } from './types';

const mockConfirmDelete = vi.fn();

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: (...args: unknown[]) => mockConfirmDelete(...args),
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

function regularStack(name = 'web'): DecoratedStack {
  return new StackViewModel(createMockStack({ Name: name, Id: 7 }));
}

function renderActions(selected: DecoratedStack[], onRemove = vi.fn()) {
  const Wrapped = withTestRouter(TableActions);
  return {
    onRemove,
    ...render(<Wrapped selectedItems={selected} onRemove={onRemove} />),
  };
}

describe('REQ-STK-01 StacksDatatable TableActions', () => {
  beforeEach(() => {
    mockConfirmDelete.mockReset();
    mockConfirmDelete.mockResolvedValue(true);
  });

  it('disables remove when nothing is selected and shows add stack', () => {
    renderActions([]);

    expect(screen.getByTestId('stack-removeStackButton')).toBeDisabled();
    expect(screen.getByTestId('stack-addStackButton')).toBeVisible();
    expect(screen.getByText('Add stack')).toBeVisible();
  });

  it('calls onRemove with selected stacks after confirm', async () => {
    const user = userEvent.setup();
    const selected = [regularStack()];
    const { onRemove } = renderActions(selected);

    await user.click(screen.getByTestId('stack-removeStackButton'));

    await waitFor(() => expect(mockConfirmDelete).toHaveBeenCalled());
    expect(onRemove).toHaveBeenCalledWith(selected);
  });

  it('does not call onRemove when confirm is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirmDelete.mockResolvedValue(false);
    const { onRemove } = renderActions([regularStack()]);

    await user.click(screen.getByTestId('stack-removeStackButton'));

    await waitFor(() => expect(mockConfirmDelete).toHaveBeenCalled());
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('accepts external stacks in the selected list type', () => {
    const external = new ExternalStackViewModel(
      'ext',
      StackType.DockerCompose,
      Date.now()
    );
    renderActions([external]);
    expect(screen.getByTestId('stack-removeStackButton')).not.toBeDisabled();
  });
});
