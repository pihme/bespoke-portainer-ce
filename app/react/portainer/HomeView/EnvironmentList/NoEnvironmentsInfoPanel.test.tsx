import { render, screen } from '@testing-library/react';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { NoEnvironmentsInfoPanel } from './NoEnvironmentsInfoPanel';

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

describe('REQ-ENV-01 NoEnvironmentsInfoPanel', () => {
  it('points admins at the environment wizard', () => {
    const Wrapped = withTestRouter(() => (
      <NoEnvironmentsInfoPanel isAdmin />
    ));
    render(<Wrapped />);

    expect(screen.getByTestId('wizard-add-environments-link')).toBeVisible();
    expect(screen.getByText(/environment wizard/i)).toBeVisible();
  });

  it('tells non-admins to contact an administrator', () => {
    const Wrapped = withTestRouter(() => (
      <NoEnvironmentsInfoPanel isAdmin={false} />
    ));
    render(<Wrapped />);

    expect(
      screen.getByText(/do not have access to any environment/i)
    ).toBeVisible();
    expect(
      screen.queryByTestId('wizard-add-environments-link')
    ).not.toBeInTheDocument();
  });
});
