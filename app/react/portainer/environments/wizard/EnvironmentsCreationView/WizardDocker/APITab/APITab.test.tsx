import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./APIForm', () => ({
  APIForm: () => <div data-cy="api-form">api form</div>,
}));

import { APITab } from './APITab';

describe('APITab', () => {
  it('renders the API form', () => {
    render(<APITab onCreate={() => {}} />);
    expect(screen.getByTestId('api-form')).toBeVisible();
  });
});
