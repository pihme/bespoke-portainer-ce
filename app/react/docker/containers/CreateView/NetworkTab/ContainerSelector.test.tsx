import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';

import { ContainerSelector } from './ContainerSelector';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('../../queries/useContainers', () => ({
  useContainers: (_id: number, opts: { select?: (c: unknown[]) => unknown }) => ({
    data: opts.select?.([
      { Id: '1', Names: ['/web'] },
      { Id: '2', Names: ['/db'] },
    ]),
    isLoading: false,
  }),
}));

describe('REQ-CTR-03 ContainerSelector', () => {
  it('loads running containers as options', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => <ContainerSelector value="/web" onChange={vi.fn()} />,
        createMockUser()
      )
    );
    render(<Wrapped />);

    expect(await screen.findByRole('combobox')).toBeVisible();
  });
});
