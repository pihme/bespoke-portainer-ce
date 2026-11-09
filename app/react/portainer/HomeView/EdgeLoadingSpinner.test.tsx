import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EdgeLoadingSpinner } from './EdgeLoadingSpinner';

describe('EdgeLoadingSpinner', () => {
  it('shows connecting copy while waiting on an edge tunnel', () => {
    render(<EdgeLoadingSpinner />);
    expect(
      screen.getByText(/Connecting to the Edge environment/i)
    ).toBeVisible();
  });
});
