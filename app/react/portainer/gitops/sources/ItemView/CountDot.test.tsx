import { render, screen } from '@testing-library/react';

import { CountDot } from './CountDot';

describe('REQ-GIT-01 CountDot', () => {
  it('TestREQ_GIT_01_shows_count_and_plural_aria_label', () => {
    render(<CountDot value={3} type="workflow" />);

    expect(screen.getByRole('status', { name: '3 workflows' })).toHaveTextContent(
      '3'
    );
  });

  it('TestREQ_GIT_01_defaults_missing_value_to_zero', () => {
    render(<CountDot value={undefined} type="workflow" />);

    expect(screen.getByRole('status', { name: '0 workflows' })).toHaveTextContent(
      '0'
    );
  });
});
