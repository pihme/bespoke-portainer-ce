import { render, screen } from '@testing-library/react';

import { WorkflowsCountDot } from './WorkflowsCountDot';

const workflowsState: {
  data: Array<{ id: number }> | undefined;
} = {
  data: undefined,
};

vi.mock('../queries/useSourceWorkflows', () => ({
  useSourceWorkflows: () => workflowsState,
}));

describe('REQ-GIT-01 WorkflowsCountDot', () => {
  beforeEach(() => {
    workflowsState.data = undefined;
  });

  it('TestREQ_GIT_01_shows_workflow_count_from_query', () => {
    workflowsState.data = [{ id: 1 }, { id: 2 }];

    render(<WorkflowsCountDot sourceId={7} />);

    expect(screen.getByRole('status', { name: '2 workflows' })).toHaveTextContent(
      '2'
    );
  });

  it('TestREQ_GIT_01_shows_zero_while_workflows_are_loading', () => {
    workflowsState.data = undefined;

    render(<WorkflowsCountDot sourceId={7} />);

    expect(screen.getByRole('status', { name: '0 workflows' })).toHaveTextContent(
      '0'
    );
  });
});
