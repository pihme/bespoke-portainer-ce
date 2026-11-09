import { render, screen } from '@testing-library/react';

import { DeployWidget } from './DeployWidget';

describe('DeployWidget', () => {
  it('renders title children and optional note', () => {
    render(
      <DeployWidget title="Nginx" note="Deploy me" logo="https://example.com/logo.png">
        <button type="button">Deploy</button>
      </DeployWidget>
    );
    expect(screen.getByText('Nginx')).toBeVisible();
    expect(screen.getByText('Deploy me')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeVisible();
  });

  it('renders without note or logo', () => {
    render(
      <DeployWidget title="Bare">
        <span>body</span>
      </DeployWidget>
    );
    expect(screen.getByText('Bare')).toBeVisible();
    expect(screen.getByText('body')).toBeVisible();
    expect(screen.queryByText('Information')).toBeNull();
  });
});
