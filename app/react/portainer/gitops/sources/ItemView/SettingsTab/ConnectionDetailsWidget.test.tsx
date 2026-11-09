import { render, screen } from '@testing-library/react';

import { SourceDetail } from '../../queries/useSource';

import { ConnectionDetailsWidget } from './ConnectionDetailsWidget';

const baseSource: SourceDetail = {
  id: 11,
  name: 'compose-repo',
  type: 'git',
  url: 'https://github.com/org/compose.git',
  status: 'healthy',
  connection: {},
};

describe('REQ-GIT-01 ConnectionDetailsWidget', () => {
  it('TestREQ_GIT_01_shows_name_type_and_repository_url', () => {
    render(<ConnectionDetailsWidget source={baseSource} />);

    expect(screen.getByText('Connection Details')).toBeVisible();
    expect(screen.getByText('compose-repo')).toBeVisible();
    expect(screen.getByText('Git')).toBeVisible();
    expect(screen.getByTestId('source-url')).toHaveTextContent(
      'https://github.com/org/compose.git'
    );
  });

  it('TestREQ_GIT_01_falls_back_when_type_and_url_are_missing', () => {
    render(
      <ConnectionDetailsWidget
        source={{
          ...baseSource,
          // force fallbacks used by the widget
          type: undefined as unknown as SourceDetail['type'],
          name: undefined as unknown as string,
          url: undefined as unknown as string,
        }}
      />
    );

    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });
});
