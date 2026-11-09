import { render, screen } from '@testing-library/react';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { Source } from '../types';

import { SourceCard } from './SourceCard';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

const baseSource: Source = {
  id: 7,
  name: 'local-compose-repo',
  type: 'git',
  url: 'https://github.com/org/compose.git',
  status: 'healthy',
  usedBy: 2,
  environments: 1,
  lastSync: 1_700_000_000,
};

function renderCard(item: Source = baseSource) {
  const Wrapped = withTestRouter(() => <SourceCard item={item} />);
  return render(<Wrapped />);
}

describe('REQ-GIT-02 SourceCard', () => {
  it('shows name, url, status and stats for a healthy source', () => {
    renderCard();

    expect(screen.getByText('local-compose-repo')).toBeVisible();
    expect(screen.getByText('https://github.com/org/compose.git')).toBeVisible();
    expect(screen.getByText('Healthy')).toBeVisible();
    expect(screen.getByText('Workflows')).toBeVisible();
    expect(screen.getByText('Environments')).toBeVisible();
    expect(screen.getByText('Last sync')).toBeVisible();
    expect(screen.getByTestId('source-link-7')).toBeVisible();
  });

  it('shows an error line when the source has an error', () => {
    renderCard({
      ...baseSource,
      status: 'error',
      error: 'authentication failed',
    });

    expect(screen.getByText('authentication failed')).toBeVisible();
  });

  it('shows a dash for last sync when lastSync is missing', () => {
    renderCard({ ...baseSource, lastSync: 0 });

    // moment.unix(0).fromNow() is a relative string; when falsy lastSync
    // the component shows '-'. 0 is falsy.
    expect(screen.getByText('-')).toBeVisible();
  });
});
