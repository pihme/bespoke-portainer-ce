import { render, screen } from '@testing-library/react';

import { AuthWidget } from './AuthWidget';

describe('REQ-GIT-01 AuthWidget', () => {
  it('TestREQ_GIT_01_shows_basic_auth_username_when_configured', () => {
    render(<AuthWidget auth={{ username: 'git-user' }} />);

    expect(screen.getByText('Authentication')).toBeVisible();
    expect(screen.getByTestId('source-auth-method')).toHaveTextContent('Basic');
    expect(screen.getByTestId('source-auth-credentials')).toHaveTextContent(
      'git-user'
    );
  });

  it('TestREQ_GIT_01_shows_none_when_auth_is_absent', () => {
    render(<AuthWidget />);

    expect(screen.getByTestId('source-auth-method')).toHaveTextContent('None');
    expect(
      screen.queryByTestId('source-auth-credentials')
    ).not.toBeInTheDocument();
  });
});
