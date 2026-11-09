import { render, screen } from '@testing-library/react';

import { HeaderStats } from './HeaderStats';

describe('HeaderStats', () => {
  it('renders stat children in a row', () => {
    render(
      <HeaderStats>
        <span>CPU</span>
        <span>Memory</span>
      </HeaderStats>
    );

    expect(screen.getByText('CPU')).toBeVisible();
    expect(screen.getByText('Memory')).toBeVisible();
  });
});
