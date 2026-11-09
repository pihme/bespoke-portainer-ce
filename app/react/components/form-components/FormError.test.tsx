import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormError } from './FormError';

describe('FormError', () => {
  it('renders nothing when children are empty', () => {
    const { container } = render(<FormError>{null}</FormError>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an alert with the message and optional className', () => {
    render(<FormError className="extra">Name is required</FormError>);
    const alert = screen.getByRole('alert', { name: 'Name is required' });
    expect(alert).toBeVisible();
    expect(alert).toHaveClass('extra');
    expect(screen.getByText('Name is required')).toBeVisible();
  });
});
