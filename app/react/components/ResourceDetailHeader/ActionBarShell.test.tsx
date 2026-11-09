import { render, screen } from '@testing-library/react';

import { ActionBarShell } from './ActionBarShell';

describe('ActionBarShell', () => {
  it('renders children inside the action bar shell', () => {
    render(
      <ActionBarShell>
        <span>Left actions</span>
        <span>Right actions</span>
      </ActionBarShell>
    );

    expect(screen.getByText('Left actions')).toBeVisible();
    expect(screen.getByText('Right actions')).toBeVisible();
  });

  it('merges a custom className onto the shell', () => {
    const { container } = render(
      <ActionBarShell className="my-shell">
        <span>content</span>
      </ActionBarShell>
    );

    expect(container.firstElementChild).toHaveClass('my-shell');
  });
});
